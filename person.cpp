#include "person.h"


person::person(std::string name, std::string birthday, Gender gender,
                      person* father, person* mother)
    : id(nextId++), name(std::move(name)), birthday(std::move(birthday)), gender(gender) {
    setFather(father);
    setMother(mother);
}

person::~person() {
    if (father) {
        father->removeChildLink(this);
    }
    if (mother) {
        mother->removeChildLink(this);
    }

    for (person* spouse : spouses) {
        if (spouse) {
            spouse->removeSpouseLink(this);
        }
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

void person::setFather(person* newFather) {
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

void person::setMother(person* newMother) {
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

void person::addChild(person* child, ParentRole role) {
    if (!child || child == this) {
        return;
    }

    if (role == ParentRole::Father) {
        child->setFather(this);
    } else {
        child->setMother(this);
    }
}

void person::addSpouse(person* spouse) {
    if (!spouse || spouse == this ||
        std::find(spouses.begin(), spouses.end(), spouse) != spouses.end()) {
        return;
    }

    spouses.push_back(spouse);
    if (std::find(spouse->spouses.begin(), spouse->spouses.end(), this) ==
        spouse->spouses.end()) {
        spouse->spouses.push_back(this);
    }
}

void person::removeSpouse(person* spouse) {
    if (!spouse) {
        return;
    }

    removeSpouseLink(spouse);
    spouse->removeSpouseLink(this);
}

void person::displayPerson() const {
    std::cout << "ID: " << id
              << ", Name: " << name
              << ", Birthday: " << birthday;

    if (father) {
        std::cout << ", Father: " << father->name;
    }

    if (mother) {
        std::cout << ", Mother: " << mother->name;
    }

    if (!spouses.empty()) {
        std::cout << ", Spouse: " << spouses.front()->name;
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

void person::displayTree(int /*level*/) const {
    std::unordered_set<const person*> visited;
    displayTreeImpl("", "", visited);
}

void person::displayForest(const std::vector<person*>& people) {
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

/**
 * @brief Recursively prints descendants while preventing cycles and repeats.
 * @param prefix Indentation accumulated from ancestor branches.
 * @param branch Branch marker to print before the current person.
 * @param visited Persons already printed during the traversal.
 */
void person::displayTreeImpl(
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

/** @brief Removes a child pointer without changing the child's parent fields. */
void person::removeChildLink(person* child) {
    children.erase(
        std::remove(children.begin(), children.end(), child),
        children.end());
}

/** @brief Removes a spouse pointer without performing reciprocal cleanup. */
void person::removeSpouseLink(person* spouse) {
    spouses.erase(
        std::remove(spouses.begin(), spouses.end(), spouse),
        spouses.end());
}