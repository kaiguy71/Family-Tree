#include "person.h"
#include <iostream>
#include <memory>
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
int main() {
    vector<std::unique_ptr<person>> personList;

    personList.push_back(std::make_unique<person>("John Doe", "01-01-1950"));
    personList.push_back(std::make_unique<person>("Jane Doe", "02-02-1952"));
    personList.push_back(std::make_unique<person>("Michael Doe", "03-03-1975"));
    personList.push_back(std::make_unique<person>("Sarah Doe", "04-04-1978"));
    personList.push_back(std::make_unique<person>("Emily Doe", "05-05-2000"));
    personList.push_back(std::make_unique<person>("James Doe", "06-06-2002"));
    personList.push_back(std::make_unique<person>("William Doe", "07-07-2025"));

    
    personList[2]->addChild(personList[4].get(), person::ParentRole::Father);
    personList[2]->addChild(personList[5].get(), person::ParentRole::Father);
    personList[3]->addChild(personList[4].get(), person::ParentRole::Mother);
    personList[3]->addChild(personList[5].get(), person::ParentRole::Mother);
    personList[6]->addChild(personList[2].get(), person::ParentRole::Father);

    for (const auto& p : personList) {
        p->displayPerson();
    }

    std::cout << "\nFamily Tree:\n";

    std::vector<person*> people;
    people.reserve(personList.size());

    for (const auto& p : personList) {
        people.push_back(p.get());
    }

    person::displayForest(people);

    return 0;
}