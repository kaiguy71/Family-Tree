CXX := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -pedantic
TARGET := family_tree.prog
SOURCES := main.cc person.cc
OBJECTS := $(SOURCES:.cc=.o)

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $^ -o $@
	rm -f *.o

%.o: %.cc person.h
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(TARGET)