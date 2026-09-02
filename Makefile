CXX := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -pedantic
TARGET := family_tree
SOURCES := main.cc
OBJECTS := $(SOURCES:.cc=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $^ -o $@

%.o: %.cc person.h
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)