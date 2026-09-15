// Compile from the project root:
// g++ -std=c++17 -Wall -Wextra -pedantic tests/birthday_validation.cpp person.cpp family_tree.cpp -o /tmp/birthday_validation
#include "../server.cpp"
#include <cassert>
#include <iostream>

int main() {
    assert(youngerParent("01-02-2000", "01-01-2000"));
    assert(youngerParent("02-01-2000", "01-31-2000"));
    assert(youngerParent("01-01-2001", "12-31-2000"));
    assert(!youngerParent("12-31-1999", "01-01-2000"));
    assert(!youngerParent("01-01-2000", "01-01-2000"));
    assert(!youngerParent("", "01-01-2000"));
    assert(!youngerParent("01-01-2000", ""));

    FamilyTree tree;
    auto* child = tree.addPerson("Child", "06-15-2000");
    auto* father = tree.addPerson("Father", "06-15-1980");
    auto* mother = tree.addPerson("Mother", "06-15-1981");
    child->setFather(father);
    child->setMother(mother);

    assert(invalidRelatedBirthday(child, "parent", "06-16-2000"));
    assert(!invalidRelatedBirthday(child, "parent", "06-14-2000"));
    assert(invalidRelatedBirthday(father, "child", "06-14-1980"));
    assert(invalidRelatedBirthday(child, "sibling", "06-14-1981"));
    assert(!invalidRelatedBirthday(child, "spouse", "06-16-2000"));
    assert(invalidBirthdayUpdate(father, "06-16-2000"));
    assert(invalidBirthdayUpdate(mother, "06-16-2000"));
    assert(invalidBirthdayUpdate(child, "06-14-1981"));
    assert(!invalidBirthdayUpdate(child, "06-15-2001"));
    assert(!invalidBirthdayUpdate(father, ""));
    assert(father->getBirthday() == "06-15-1980");
    assert(child->getBirthday() == "06-15-2000");
    std::cout << "Birthday validation checks passed\n";
}
