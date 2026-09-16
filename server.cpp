#include "server.h"
#include <algorithm>
#include <arpa/inet.h>
#include <cerrno>
#include <cstring>
#include <cstdlib>
#include <fstream>
#include <filesystem>
#include <iostream>
#include <netinet/in.h>
#include <sstream>
#include <sys/socket.h>
#include <unistd.h>

namespace {
// Dates from the browser use MM-DD-YYYY. Unknown dates cannot establish age.
long birthdayKey(const std::string& birthday) {
    if (birthday.empty()) return 0;
    std::istringstream input(birthday);
    int month = 0, day = 0, year = 0;
    char first = 0, second = 0;
    if (!(input >> month >> first >> day >> second >> year)
        || first != '-' || second != '-' || !input.eof()
        || month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return 0;
    return year * 10000L + month * 100L + day;
}

bool youngerParent(const std::string& parent, const std::string& child) {
    const long parentDate = birthdayKey(parent), childDate = birthdayKey(child);
    return parentDate && childDate && parentDate > childDate;
}

bool conflictsWithParents(const person* current, const std::string& birthday) {
    return (current->getFather() && youngerParent(current->getFather()->getBirthday(), birthday))
        || (current->getMother() && youngerParent(current->getMother()->getBirthday(), birthday));
}

bool invalidBirthdayUpdate(const person* current, const std::string& birthday) {
    if (conflictsWithParents(current, birthday)) return true;
    for (const person* child : current->getChildren()) {
        if (youngerParent(birthday, child->getBirthday())) return true;
    }
    return false;
}

bool invalidRelatedBirthday(const person* related, const std::string& relation,
                            const std::string& birthday) {
    if (!related) return false;
    if (relation == "parent") return youngerParent(birthday, related->getBirthday());
    if (relation == "child") return youngerParent(related->getBirthday(), birthday);
    if (relation == "sibling") return conflictsWithParents(related, birthday);
    return false;
}

const std::string birthdayError = "{\"error\":\"A father or mother cannot be younger than their child. Please correct the birthdate.\"}";

/** @brief Escapes backslashes and quotes for the server's JSON responses. */
std::string jsonEscape(const std::string& value) {
    std::string result;
    for (char character : value) {
        if (character == '\\' || character == '"') result += '\\';
        result += character;
    }
    return result;
}

/** @brief Extracts a quoted string property from a small JSON request body. */
std::string jsonString(const std::string& body, const std::string& key) {
    const std::string marker = "\"" + key + "\":\"";
    const std::size_t start = body.find(marker);
    if (start == std::string::npos) return {};
    const std::size_t valueStart = start + marker.size();
    const std::size_t valueEnd = body.find('"', valueStart);
    return valueEnd == std::string::npos ? std::string() : body.substr(valueStart, valueEnd - valueStart);
}

/** @brief Reads an optional JSON string property, returning an empty string when absent. */
std::string jsonStringOrEmpty(const std::string& body, const std::string& key) {
    return jsonString(body, key);
}

/** @brief Converts a gender token received from the browser into the domain enum. */
person::Gender parseGender(const std::string& value) {
    return value == "male" ? person::Gender::Male : value == "female" ? person::Gender::Female : person::Gender::Unknown;
}

/** @brief Converts a domain gender enum into the browser's string representation. */
const char* genderName(person::Gender gender) {
    return gender == person::Gender::Male ? "male" : gender == person::Gender::Female ? "female" : "unknown";
}

/** @brief Parses a base-10 integer, returning -1 when parsing cannot start. */
long parseLong(const std::string& value) {
    char* end = nullptr;
    const long result = std::strtol(value.c_str(), &end, 10);
    return end == value.c_str() ? -1 : result;
}

/** @brief Extracts and parses a numeric JSON property from a request body. */
long jsonLong(const std::string& body, const std::string& key) {
    const std::string marker = "\"" + key + "\":";
    const std::size_t start = body.find(marker);
    return start == std::string::npos ? -1 : parseLong(body.substr(start + marker.size()));
}

/** @brief Extracts an unescaped value from a URL query string. */
std::string queryValue(const std::string& query, const std::string& key) {
    const std::string marker = key + "=";
    const std::size_t start = query.find(marker);
    if (start == std::string::npos) return {};
    const std::size_t valueStart = start + marker.size();
    const std::size_t valueEnd = query.find('&', valueStart);
    return query.substr(valueStart, valueEnd == std::string::npos ? std::string::npos : valueEnd - valueStart);
}

/** @brief Serializes every person and relationship in a family tree to JSON. */
std::string peopleJson(const FamilyTree& tree) {
    std::ostringstream output;
    output << "[";
    bool first = true;
    for (const auto& entry : tree.people()) {
        const person* current = entry.get();
        if (!first) output << ",";
        first = false;
        output << "{\"id\":" << current->getId()
               << ",\"name\":\"" << jsonEscape(current->getName())
               << "\",\"birthday\":\"" << jsonEscape(current->getBirthday()) << "\""
               << ",\"gender\":\"" << genderName(current->getGender()) << "\""
               << ",\"father\":" << (current->getFather() ? std::to_string(current->getFather()->getId()) : "null")
               << ",\"mother\":" << (current->getMother() ? std::to_string(current->getMother()->getId()) : "null")
               << ",\"spouses\":[";
        for (std::size_t index = 0; index < current->getSpouses().size(); ++index) {
            if (index > 0) output << ",";
            output << current->getSpouses()[index]->getId();
        }
        output << "],\"children\":[";
        for (std::size_t index = 0; index < current->getChildren().size(); ++index) {
            if (index > 0) output << ",";
            output << current->getChildren()[index]->getId();
        }
            output << "],\"siblings\":[";
            bool firstSibling = true;
            for (const auto& candidate : tree.people()) {
                const person* other = candidate.get();
                const bool sameFather = current->getFather() && current->getFather() == other->getFather();
                const bool sameMother = current->getMother() && current->getMother() == other->getMother();
                if (other != current && (sameFather || sameMother)) {
                    if (!firstSibling) output << ",";
                    firstSibling = false;
                    output << other->getId();
                }
            }
            output << "]}";
    }
    output << "]";
    return output.str();
}

/** @brief Serializes available `.save` files in the working directory to JSON. */
std::string saveFilesJson() {
    std::ostringstream output;
    output << "[";
    bool first = true;
    for (const auto& entry : std::filesystem::directory_iterator(".")) {
        if (!entry.is_regular_file() || entry.path().extension() != ".save") continue;
        if (!first) output << ",";
        first = false;
        output << "\"" << jsonEscape(entry.path().filename().string()) << "\"";
    }
    output << "]";
    return output.str();
}

std::string saveFilePath(const std::string& treename) {
    return treename.size() >= 5 && treename.substr(treename.size() - 5) == ".save"
        ? treename : treename + ".save";
}

std::string savedLayoutJson(const std::string& treename) {
    std::ifstream input(saveFilePath(treename));
    std::ostringstream output;
    output << "[";
    std::string line;
    bool first = true;
    while (std::getline(input, line)) {
        if (line.rfind("P ", 0) != 0) continue;
        std::istringstream fields(line.substr(2));
        long id;
        double x, y;
        if (!(fields >> id >> x >> y)) continue;
        if (!first) output << ",";
        first = false;
        output << "{\"id\":" << id << ",\"x\":" << x << ",\"y\":" << y << "}";
    }
    output << "]";
    return output.str();
}

/** @brief Sends an HTTP response and logs failed responses to standard error. */
void respond(int client, int status, const std::string& type, const std::string& body) {
    if (status >= 400) {
        std::cerr << "[server] request failed (" << status << "): " << body << '\n';
    }
    std::ostringstream response;
    response << "HTTP/1.1 " << status << (status == 200 ? " OK" : " Bad Request") << "\r\n"
             << "Content-Type: " << type << "\r\nContent-Length: " << body.size()
             << "\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n" << body;
    const std::string message = response.str();
    send(client, message.c_str(), message.size(), 0);
}

/** @brief Parses one client request and dispatches it to the tree or static files. */
void handleRequest(int client, FamilyTree& tree) {
    char buffer[16384] = {};
    const ssize_t length = recv(client, buffer, sizeof(buffer) - 1, 0);
    if (length <= 0) return;
    const std::string request(buffer, static_cast<std::size_t>(length));
    const std::size_t lineEnd = request.find("\r\n");
    std::istringstream line(request.substr(0, lineEnd));
    std::string method;
    std::string path;
    line >> method >> path;
    const std::size_t bodyStart = request.find("\r\n\r\n");
    const std::string body = bodyStart == std::string::npos ? "" : request.substr(bodyStart + 4);

    if (method == "GET" && path == "/api/people") {
        respond(client, 200, "application/json", peopleJson(tree));
    } else if (method == "GET" && path == "/api/savefiles") {
        respond(client, 200, "application/json", saveFilesJson());
    } else if (method == "POST" && path == "/api/save") {
        const std::string treename = jsonString(body, "treename");
        const std::string layout = jsonString(body, "layout");
        if (treename.empty() || !tree.save(treename)) respond(client, 400, "application/json", "{\"error\":\"Could not save family tree\"}");
        else {
            std::ofstream output(saveFilePath(treename), std::ios::app);
            if (!output) respond(client, 400, "application/json", "{\"error\":\"Could not save family layout\"}");
            else {
                std::istringstream entries(layout);
                std::string entry;
                while (std::getline(entries, entry, ';')) {
                    std::replace(entry.begin(), entry.end(), ',', ' ');
                    if (!entry.empty()) output << "P " << entry << '\n';
                }
                respond(client, 200, "application/json", "{\"ok\":true}");
            }
        }
    } else if (method == "POST" && path == "/api/load") {
        const std::string treename = jsonString(body, "treename");
        if (treename.empty() || !tree.load(treename)) respond(client, 400, "application/json", "{\"error\":\"Could not load family tree\"}");
        else respond(client, 200, "application/json", "{\"ok\":true,\"positions\":" + savedLayoutJson(treename) + "}");
    } else if (method == "DELETE" && path.rfind("/api/people?", 0) == 0) {
        const long id = parseLong(queryValue(path.substr(path.find('?') + 1), "id"));
        if (!tree.remove(id)) respond(client, 404, "application/json", "{\"error\":\"Person not found\"}");
        else respond(client, 200, "application/json", "{\"ok\":true}");
    } else if (method == "DELETE" && path == "/api/people") {
        tree.clear();
        respond(client, 200, "application/json", "{\"ok\":true}");
    } else if (method == "POST" && path == "/api/people") {
        const std::string name = jsonString(body, "name");
        const std::string birthday = jsonString(body, "birthday");
        const person::Gender gender = parseGender(jsonString(body, "gender"));
        const std::string relation = jsonStringOrEmpty(body, "relation");
        const std::string role = jsonStringOrEmpty(body, "role");
        person* related = tree.find(jsonLong(body, "relatedId"));
        if (name.empty()) respond(client, 400, "application/json", "{\"error\":\"Name is required\"}");
        else if (!relation.empty() && (!related || (relation != "sibling" && relation != "spouse" && relation != "parent" && relation != "child"))) respond(client, 400, "application/json", "{\"error\":\"Invalid relationship\"}");
        else if (invalidRelatedBirthday(related, relation, birthday)) respond(client, 400, "application/json", birthdayError);
        else respond(client, 200, "application/json", "{\"id\":" + std::to_string(tree.addRelatedPerson(name, birthday, gender, related, relation, role)->getId()) + "}");
    } else if ((method == "PATCH" || method == "PUT") && path == "/api/people") {
        person* current = tree.find(jsonLong(body, "id"));
        const std::string name = jsonString(body, "name");
        const std::string birthday = jsonString(body, "birthday");
        const person::Gender gender = parseGender(jsonString(body, "gender"));
        if (!current || name.empty()) respond(client, 400, "application/json", "{\"error\":\"Invalid person update\"}");
        else if (invalidBirthdayUpdate(current, birthday)) respond(client, 400, "application/json", birthdayError);
        else { current->setName(name); current->setBirthday(birthday); current->setGender(gender); respond(client, 200, "application/json", "{\"ok\":true}"); }
    } else if (method == "POST" && path == "/api/relationships") {
        person* child = tree.find(jsonLong(body, "childId"));
        person* parent = tree.find(jsonLong(body, "parentId"));
        const std::string role = jsonString(body, "role");
        if (!child || !parent || (role != "father" && role != "mother")) respond(client, 400, "application/json", "{\"error\":\"Invalid relationship\"}");
        else if (youngerParent(parent->getBirthday(), child->getBirthday())) respond(client, 400, "application/json", birthdayError);
        else { parent->addChild(child, role == "father" ? person::ParentRole::Father : person::ParentRole::Mother); respond(client, 200, "application/json", "{\"ok\":true}"); }
    } else if (method == "POST" && path == "/api/marriages") {
        person* first = tree.find(jsonLong(body, "firstId"));
        person* second = tree.find(jsonLong(body, "secondId"));
        if (!first || !second || first == second) respond(client, 400, "application/json", "{\"error\":\"Invalid marriage\"}");
        else { first->addSpouse(second); respond(client, 200, "application/json", "{\"ok\":true}"); }
    } else if (method == "DELETE" && path.rfind("/api/relationships?", 0) == 0) {
        const std::string query = path.substr(path.find('?') + 1);
        const long childId = parseLong(queryValue(query, "childId"));
        const std::string role = queryValue(query, "role");
        person* child = tree.find(childId);
        if (!child || (role != "father" && role != "mother")) respond(client, 400, "application/json", "{\"error\":\"Invalid relationship\"}");
        else { if (role == "father") child->setFather(nullptr); else child->setMother(nullptr); respond(client, 200, "application/json", "{\"ok\":true}"); }
    } else if (method == "DELETE" && path.rfind("/api/marriages?", 0) == 0) {
        const std::string query = path.substr(path.find('?') + 1);
        const long firstId = parseLong(queryValue(query, "firstId"));
        const long secondId = parseLong(queryValue(query, "secondId"));
        person* first = tree.find(firstId);
        person* second = tree.find(secondId);
        if (!first || !second) respond(client, 400, "application/json", "{\"error\":\"Invalid marriage\"}");
        else { first->removeSpouse(second); respond(client, 200, "application/json", "{\"ok\":true}"); }
    } else if (method == "GET" || method == "HEAD") {
        const std::string filePath = path == "/" ? "client/index.html" : "client" + path;
        std::ifstream file(filePath, std::ios::binary);
        if (!file) respond(client, 404, "text/plain", "Not found");
        else {
            std::ostringstream content;
            content << file.rdbuf();
            const std::string type = path == "/" || path.find(".html") != std::string::npos
                ? "text/html"
                : path.find(".css") != std::string::npos ? "text/css" : "application/javascript";
            respond(client, 200, type, method == "HEAD" ? "" : content.str());
        }
    } else {
        respond(client, 400, "application/json", "{\"error\":\"Unsupported request\"}");
    }
}
}

int runServer(FamilyTree& tree, int port) {
    const int server = socket(AF_INET, SOCK_STREAM, 0);
    if (server < 0) { std::cerr << "Could not create server socket\n"; return 1; }
    int reuse = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons(static_cast<uint16_t>(port));
    if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0 || listen(server, 16) < 0) {
        std::cerr << "Could not listen on port " << port << ": " << std::strerror(errno) << '\n';
        close(server);
        return 1;
    }
    std::cout << "Family tree UI: http://127.0.0.1:" << port << '\n';
    while (true) {
        const int client = accept(server, nullptr, nullptr);
        if (client >= 0) { handleRequest(client, tree); close(client); }
    }
}
