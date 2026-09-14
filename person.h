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
    /** @brief Identifies which parent role a relationship represents. */
    enum class ParentRole { Father, Mother };
    /** @brief Identifies the gender associated with a person. */
    enum class Gender { Unknown, Male, Female };
private:
    inline static long nextId = 0; // Static variable to keep track of the next available ID

    const long id;
    std::string name;
    std::string birthday;
    Gender gender = Gender::Unknown;
    person* father = nullptr;
    person* mother = nullptr;
    std::vector<person*> children;
    std::vector<person*> spouses;

    void displayTreeImpl(
        const std::string& prefix,
        const std::string& branch,
        std::unordered_set<const person*>& visited
    ) const;

    void removeChildLink(person* child);
    void removeSpouseLink(person* spouse);

public:
        /**
         * @brief Creates a person and optionally connects the person to parents.
         * @param name Display name for the person.
         * @param birthday Birthday text stored for the person.
         * @param gender Gender classification used by the application.
         * @param father Optional father to connect during construction.
         * @param mother Optional mother to connect during construction.
         */
        person(std::string name, std::string birthday, Gender gender = Gender::Unknown,
           person* father = nullptr, person* mother = nullptr);

        /** @brief Disables copying because relationships are represented by raw pointers. */
    person(const person&) = delete;
        /** @brief Disables copy assignment for identity-bearing person objects. */
    person& operator=(const person&) = delete;
        /** @brief Disables moving because relationships refer to object addresses. */
    person(person&&) = delete;
        /** @brief Disables move assignment for identity-bearing person objects. */
    person& operator=(person&&) = delete;

        /** @brief Disconnects this person from all remaining relationships. */
    ~person();

        /** @brief Returns the person's display name. */
    const std::string& getName() const { return name; }
        /** @brief Returns the stored birthday text. */
    const std::string& getBirthday() const { return birthday; }
        /** @brief Returns the person's gender classification. */
    Gender getGender() const { return gender; }
        /** @brief Returns the father, or nullptr when none is assigned. */
    person* getFather() const { return father; }
        /** @brief Returns the mother, or nullptr when none is assigned. */
    person* getMother() const { return mother; }
        /** @brief Returns the non-owning list of children. */
    const std::vector<person*>& getChildren() const { return children; }
        /** @brief Returns the non-owning list of spouses. */
    const std::vector<person*>& getSpouses() const { return spouses; }
        /** @brief Returns the immutable unique identifier assigned at construction. */
    long getId() const { return id; }

        /** @brief Replaces the person's display name. */
    void setName(std::string newName) { name = std::move(newName); }
        /** @brief Replaces the stored birthday text. */
    void setBirthday(std::string newBirthday) { birthday = std::move(newBirthday); }
        /** @brief Replaces the person's gender classification. */
    void setGender(Gender newGender) { gender = newGender; }

        /** @brief Assigns a father and keeps the parent-child link bidirectional. */
    void setFather(person* newFather);
        /** @brief Assigns a mother and keeps the parent-child link bidirectional. */
    void setMother(person* newMother);
        /** @brief Adds this person as a child using the requested parent role. */
    void addChild(person* child, ParentRole role);
        /** @brief Adds a reciprocal spouse relationship unless it already exists. */
    void addSpouse(person* spouse);
        /** @brief Removes a reciprocal spouse relationship when present. */
    void removeSpouse(person* spouse);

        /** @brief Prints this person's fields and immediate relationships. */
    void displayPerson() const;
        /** @brief Prints this person's descendant tree in an indented format. */
    void displayTree(int level = 0) const;

        /** @brief Prints all disconnected and connected family trees in the collection. */
    static void displayForest(const std::vector<person*>& people);
};


#endif