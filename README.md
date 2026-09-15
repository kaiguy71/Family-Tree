# Family Tree Application
*Ohio University Computer Science Fall 2026*
<code> Contributors: Kai Battistoni, Joey Ruffing, Ethan Claybourn, Abram Eastham, Chayse Collins</code>
_____


<p>This C++ & JS webapp allows users to intuitively track their lineage and familial relationships visually.   


Compile with command : <code>make clean && make</code>
Run with command : <code>./family_tree.prog --server [optional: port, default is 8080]</code>
Example : <code>./family_tree.prog --server 12345</code> to start a webserver on port 12345.</p>


<p>To use the local browser interface, run the server and open
<code>http://127.0.0.1:8080</code> (do not open <code>client/index.html</code> as a file).
The interface reads and updates the C++ <code>person</code> objects directly.

The map initializes empty. Use the plus button to add the first person, then select
that person to edit them, or add a sibling, parent, child, or spouse branch.

Birthday inputs and gender are optional; when provided, the value year of birth is displayed beneath each person, 
and gender defines sphere color. 

The graph uses connected family systems with parent-centered child orbits.

Use the 'Save map' button to create a named <code>.save</code> file. If one already exists, it will prompt you to load it upon accessing the webapp.
The person editor allows individuals' relationships and data to be edited manually. 
Use the add button below the graph to create a disconnected person. 

FamilyTree provides plaintext persistence through <code>save("treename")</code> and <code>load("treename")</code>, which use
<code>treename.save</code>. Changes are otherwise held in memory until the server stops.</p>

___
[*Email*](kb877325@ohio.edu)
