#include "person.h"
#include "family_tree.h"
#include "server.h"
#include <iostream>
#include <string>
#include <vector>


using namespace std;
/**
 * @brief Main function to demonstrate the usage of the person class and create a simple family tree.
 * 
 * Creates a list of person objects, establishes parent-child relationships, ...
 *      and displays the information of each person along with the family tree.
 * 
 * Currently, ID values are in tandem with the order of creation, but this may change in the future.
 *      The display functions will show the correct relationships regardless of ID values.
 * @return int 
 */
/**
 * @brief Starts the family tree application or its local HTTP server.
 * @param argc Number of command-line arguments.
 * @param argv Command-line arguments; `--server` enables server mode and an
 * optional second argument selects the port.
 * @return Server status in server mode, or zero after the console display.
 */
int main(int argc, char* argv[]) {
    FamilyTree tree;

    if (argc > 1 && std::string(argv[1]) == "--server") {
        try {
            const int port = argc > 2 ? std::stoi(argv[2]) : 8080;
            return runServer(tree, port);
        } catch (const std::exception& error) {
            std::cerr << "[fatal] server startup failed: " << error.what() << '\n';
            return 1;
        }
    }

    for (const auto& p : tree.people()) {
        p->displayPerson();
    }

    std::cout << "\nFamily Tree:\n";

    std::vector<person*> people;
    people.reserve(tree.people().size());

    for (const auto& p : tree.people()) {
        people.push_back(p.get());
    }

    person::displayForest(people);

    return 0;
}