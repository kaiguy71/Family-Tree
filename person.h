#include <string>
#include <vector>
#include <iostream>
#include <algorithm>
#include <unordered_set>
#include <functional>

#ifndef PERSON_H
#define PERSON_H

/**
 * @brief Represents a person in the family tree
 * 
 * Stores name, birthday, father, mother, and children of the person with appropriate getters and setters.
 * Constructor allows for creating a person with or without parents. Destructor cleans up the children vector.
 * 
 * Uses a static variable to assign unique IDs to each person. Provides methods to display the person's information and the family tree.
 * Operator overloads on the person class are deleted to prevent copying or moving of person objects.
 * 
 * Children are stored as raw pointers, and the parent-child relationships are managed through the addChild, setFather, and setMother methods.
 * Adding a child to a parent automatically sets the parent for the child, and vice versa.
 * 
 * C++17 features are used, including smart pointers and inline member functions.
 */
class person
{
public:
    enum class ParentRole { Father, Mother };
private:
    inline static long nextId = 0; // Static variable to keep track of the next available ID

    const long id;
    std::string name;
    std::string birthday;
    person* father = nullptr;
    person* mother = nullptr;
    std::vector<person*> children;

    void displayTreeImpl(
        const std::string& prefix,
        const std::string& branch,
        std::unordered_set<const person*>& visited
    ) const;

    void removeChildLink(person* child);

public:
    person(std::string name, std::string birthday,
           person* father = nullptr, person* mother = nullptr);

    person(const person&) = delete;
    person& operator=(const person&) = delete;
    person(person&&) = delete;
    person& operator=(person&&) = delete;

    ~person();

    const std::string& getName() const { return name; }
    const std::string& getBirthday() const { return birthday; }
    person* getFather() const { return father; }
    person* getMother() const { return mother; }
    const std::vector<person*>& getChildren() const { return children; }
    long getId() const { return id; }

    void setFather(person* newFather);
    void setMother(person* newMother);
    void addChild(person* child, ParentRole role);

    void displayPerson() const;
    void displayTree(int level = 0) const;

    static void displayForest(const std::vector<person*>& people);
};

inline person::person(std::string name, std::string birthday,
                      person* father, person* mother)
    : id(nextId++), name(std::move(name)), birthday(std::move(birthday)) {
    setFather(father);
    setMother(mother);
}

inline person::~person() {
    if (father) {
        father->removeChildLink(this);
    }
    if (mother) {
        mother->removeChildLink(this);
    }

    for (person* child : children) {
        if (child->father == this) {
            child->father = nullptr;
        }
        if (child->mother == this) {
            child->mother = nullptr;
        }
    }
}

inline void person::setFather(person* newFather) {
    if (newFather == this || father == newFather) {
        return;
    }

    if (father) {
        father->removeChildLink(this);
    }

    father = newFather;

    if (father &&
        std::find(father->children.begin(), father->children.end(), this) ==
            father->children.end()) {
        father->children.push_back(this);
    }
}

inline void person::setMother(person* newMother) {
    if (newMother == this || mother == newMother) {
        return;
    }

    if (mother) {
        mother->removeChildLink(this);
    }

    mother = newMother;

    if (mother &&
        std::find(mother->children.begin(), mother->children.end(), this) ==
            mother->children.end()) {
        mother->children.push_back(this);
    }
}

inline void person::addChild(person* child, ParentRole role) {
    if (!child || child == this) {
        return;
    }

    if (role == ParentRole::Father) {
        child->setFather(this);
    } else {
        child->setMother(this);
    }
}

inline void person::displayPerson() const {
    std::cout << "ID: " << id
              << ", Name: " << name
              << ", Birthday: " << birthday;

    if (father) {
        std::cout << ", Father: " << father->name;
    }

    if (mother) {
        std::cout << ", Mother: " << mother->name;
    }

    if (!children.empty()) {
        std::cout << ", Children: ";

        for (const person* child : children) {
            std::cout << child->name << " (ID: "
                      << child->id << "); ";
        }
    }

    std::cout << '\n';
}

inline void person::displayTree(int /*level*/) const {
    std::unordered_set<const person*> visited;
    displayTreeImpl("", "", visited);
}

inline void person::displayForest(const std::vector<person*>& people) {
    std::unordered_set<const person*> visited;

    std::function<bool(const person*)> hasAncestor =
        [&](const person* current) {
            if (!current) {
                return false;
            }

            return current->father || current->mother ||
                   hasAncestor(current->father) ||
                   hasAncestor(current->mother);
        };

    std::vector<const person*> roots;

    for (const person* current : people) {
        if (!current || current->father || current->mother) {
            continue;
        }

        bool secondaryRoot = false;

        // Do not start a separate tree from a co-parent whose children
        // belong to a deeper ancestor line.
        for (const person* child : current->children) {
            if (!child) {
                continue;
            }

            const person* otherParent =
                child->father == current ? child->mother : child->father;

            if (otherParent && hasAncestor(otherParent)) {
                secondaryRoot = true;
                break;
            }
        }

        if (!secondaryRoot) {
            roots.push_back(current);
        }
    }

    for (const person* root : roots) {
        root->displayTreeImpl("", "", visited);
    }

    // Fallback for disconnected or cyclic data.
    for (const person* current : people) {
        if (current && visited.find(current) == visited.end()) {
            current->displayTreeImpl("", "", visited);
        }
    }
}

inline void person::displayTreeImpl(
    const std::string& prefix,
    const std::string& branch,
    std::unordered_set<const person*>& visited
) const {
    if (!visited.insert(this).second) {
        return;
    }

    std::cout << prefix << branch
              << name << " (" << birthday << "), ID " << id << '\n';

    std::vector<const person*> unvisitedChildren;

    for (const person* child : children) {
        if (child && visited.find(child) == visited.end()) {
            unvisitedChildren.push_back(child);
        }
    }

    if (unvisitedChildren.empty()) {
        return;
    }

    std::cout << prefix
              << (branch.empty() ? "" : "    ")
              << "Children:\n";

    for (std::size_t i = 0; i < unvisitedChildren.size(); ++i) {
        const person* child = unvisitedChildren[i];
        bool lastChild = i + 1 == unvisitedChildren.size();

        std::string childPrefix =
            prefix + (branch.empty() ? "" : "    ");

        child->displayTreeImpl(
            childPrefix,
            lastChild ? "`-- " : "|-- ",
            visited
        );
    }
}

inline void person::removeChildLink(person* child) {
    children.erase(
        std::remove(children.begin(), children.end(), child),
        children.end());
}

#endif