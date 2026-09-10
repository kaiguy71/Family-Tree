CXX := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -pedantic
TARGET := family_tree.prog
SOURCES := main.cpp person.cpp family_tree.cpp server.cpp
OBJECTS := $(SOURCES:.cpp=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $^ -o $@
	rm -f *.o

%.o: %.cpp person.h family_tree.h server.h
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)