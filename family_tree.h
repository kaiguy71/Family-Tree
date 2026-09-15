#ifndef FAMILY_TREE_H
#define FAMILY_TREE_H

#include "person.h"
#include <memory>
#include <string>
#include <vector>

/**
 * @brief Owns the people in an application family tree.
 *
 * The tree owns each person with a unique pointer while person objects retain
 * non-owning pointers for their relationships.
 */
class FamilyTree {
private:
    std::vector<std::unique_ptr<person>> peopleList;

public:
    /** @brief Creates an empty family tree. */
    FamilyTree();
    /** @brief Returns the owned people in insertion order. */
    const std::vector<std::unique_ptr<person>>& people() const { return peopleList; }
    /** @brief Finds a person by ID, or returns nullptr when absent. */
    person* find(long id) const;
    /** @brief Creates and owns an unrelated person. */
    person* addPerson(const std::string& name, const std::string& birthday, person::Gender gender = person::Gender::Unknown);
    /** @brief Removes every person and all relationships from the tree. */
    void clear();
    /** @brief Removes one person and disconnects all of their relationships. */
    bool remove(long id);
    /** @brief Writes the tree to a `.save` file and reports whether it succeeded. */
    bool save(const std::string& treename) const;
    /** @brief Loads a `.save` file, replacing the current tree on success. */
    bool load(const std::string& treename);
    /**
     * @brief Creates a person and optionally connects it to an existing person.
     * @param name Name of the new person.
     * @param birthday Birthday text for the new person.
     * @param gender Gender classification for the new person.
     * @param related Existing person that anchors the requested relationship.
     * @param relation Relationship type such as `parent`, `child`, `sibling`, or `spouse`.
     * @param role Parent role used when the relationship requires one.
     * @return Pointer to the newly owned person.
     */
    person* addRelatedPerson(const std::string& name, const std::string& birthday, person::Gender gender,
                             person* related, const std::string& relation,
                             const std::string& role);
};

#endif