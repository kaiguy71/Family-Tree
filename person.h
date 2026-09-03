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


#endif