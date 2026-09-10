#ifndef FAMILY_TREE_H
#define FAMILY_TREE_H

#include "person.h"
#include <memory>
#include <string>
#include <vector>

class FamilyTree {
private:
    std::vector<std::unique_ptr<person>> peopleList;

public:
    FamilyTree();
    const std::vector<std::unique_ptr<person>>& people() const { return peopleList; }
    person* find(long id) const;
    person* addPerson(const std::string& name, const std::string& birthday, person::Gender gender = person::Gender::Unknown);
    void clear();
    bool save(const std::string& treename) const;
    bool load(const std::string& treename);
    person* addRelatedPerson(const std::string& name, const std::string& birthday, person::Gender gender,
                             person* related, const std::string& relation,
                             const std::string& role);
};

#endif