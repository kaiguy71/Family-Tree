#include <string>
#include <vector>

/**
 * @brief Represents a person in the family tree
 * 
 * Stores name, birthday, father, mother, and children of the person with appropriate getters and setters.
 * Constructor allows for creating a person with or without parents. Destructor cleans up the children vector.
 * 
 * !!
 * Need to implement methods to add children and set parents, as well as any other necessary functionality for managing the family tree.
 * !!
 */
class person
{
private:
    std::string name, birthday;
    person* father;
    person* mother;
    std::vector<person*> children;

public:
    person(std::string name, std::string birthday, person* father, person* mother);
    person(std::string name, std::string birthday);
    ~person();

    person* getFather() const { return father; }
    person* getMother() const { return mother; }
    std::vector<person*> getChildren() const { return children; }

};

person::person(std::string name, std::string birthday, person* father, person* mother) : name(name), birthday(birthday), father(father), mother(mother)
{
}

person::person(std::string name, std::string birthday) : name(name), birthday(birthday), father(nullptr), mother(nullptr)
{
}


person::~person()
{
    for (auto child : children){
        delete child;
    }
}
