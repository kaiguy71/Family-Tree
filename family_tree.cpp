#include "family_tree.h"
#include <fstream>
#include <iomanip>
#include <unordered_map>
#include <vector>
#include <sstream>

namespace {
/** @brief Ensures a tree name has the `.save` persistence extension. */
std::string savePath(const std::string& treename) {
    return treename.size() >= 5 && treename.substr(treename.size() - 5) == ".save"
        ? treename
        : treename + ".save";
}
}

FamilyTree::FamilyTree() {
}

person* FamilyTree::find(long id) const {
    for (const auto& candidate : peopleList) {
        if (candidate->getId() == id) return candidate.get();
    }
    return nullptr;
}

person* FamilyTree::addPerson(const std::string& name, const std::string& birthday, person::Gender gender) {
    peopleList.push_back(std::make_unique<person>(name, birthday, gender));
    return peopleList.back().get();
}

void FamilyTree::clear() {
    peopleList.clear();
}

bool FamilyTree::remove(long id) {
    const auto it = std::find_if(peopleList.begin(), peopleList.end(),
        [id](const std::unique_ptr<person>& candidate) {
            return candidate && candidate->getId() == id;
        });
    if (it == peopleList.end()) return false;
    peopleList.erase(it);
    return true;
}

bool FamilyTree::save(const std::string& treename) const {
    std::ofstream output(savePath(treename));
    if (!output) return false;

    for (const auto& entry : peopleList) {
        const person* current = entry.get();
         output << current->getId() << ' ' << std::quoted(current->getName()) << ' '
             << std::quoted(current->getBirthday()) << ' '
             << std::quoted(current->getGender() == person::Gender::Male ? "male" : current->getGender() == person::Gender::Female ? "female" : "unknown") << ' '
               << (current->getFather() ? current->getFather()->getId() : -1) << ' '
               << (current->getMother() ? current->getMother()->getId() : -1) << ' '
               << current->getSpouses().size();
        for (const person* spouse : current->getSpouses()) output << ' ' << spouse->getId();
        output << '\n';
    }
    return output.good();
}

bool FamilyTree::load(const std::string& treename) {
    struct Record { long id; std::string name; std::string birthday; std::string gender; long father; long mother; std::vector<long> spouses; };
    std::ifstream input(savePath(treename));
    if (!input) return false;
    std::vector<Record> records;
    Record record;
    std::string line;
    while (std::getline(input, line)) {
        if (line.empty()) continue;
        if (line.rfind("P ", 0) == 0) continue;
        std::istringstream fields(line);
        std::size_t spouseCount = 0;
        if (fields >> record.id >> std::quoted(record.name) >> std::quoted(record.birthday)
            >> std::quoted(record.gender) >> record.father >> record.mother >> spouseCount) {
            // Current format includes gender.
        } else {
            fields.clear();
            fields.str(line);
            record.gender = "unknown";
            if (!(fields >> record.id >> std::quoted(record.name) >> std::quoted(record.birthday)
                  >> record.father >> record.mother >> spouseCount)) return false;
        }
        record.spouses.resize(spouseCount);
        for (long& spouse : record.spouses) if (!(fields >> spouse)) return false;
        records.push_back(record);
    }

    clear();
    std::unordered_map<long, person*> loaded;
    for (const Record& saved : records) { const auto gender = saved.gender == "male" ? person::Gender::Male : saved.gender == "female" ? person::Gender::Female : person::Gender::Unknown; loaded[saved.id] = addPerson(saved.name, saved.birthday, gender); }
    for (const Record& saved : records) {
        person* current = loaded[saved.id];
        if (saved.father != -1 && loaded.count(saved.father)) current->setFather(loaded[saved.father]);
        if (saved.mother != -1 && loaded.count(saved.mother)) current->setMother(loaded[saved.mother]);
        for (long spouse : saved.spouses) if (loaded.count(spouse)) current->addSpouse(loaded[spouse]);
    }
    return true;
}

person* FamilyTree::addRelatedPerson(const std::string& name,
                                      const std::string& birthday,
                                      person::Gender gender,
                                      person* related,
                                      const std::string& relation,
                                      const std::string& role) {
    person* created = addPerson(name, birthday, gender);
    if (!related) return created;

    if (relation == "spouse") {
        related->addSpouse(created);
    } else if (relation == "parent") {
        if (role == "father") {
            related->setFather(created);
        } else {
            related->setMother(created);
        }
    } else if (relation == "child") {
        related->addChild(created, role == "mother" ? person::ParentRole::Mother : person::ParentRole::Father);
    } else if (relation == "sibling") {
        if (related->getFather()) created->setFather(related->getFather());
        if (related->getMother()) created->setMother(related->getMother());
    }
    return created;
}