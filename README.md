# Family Tree Application
*Ohio University Computer Science 2026*
<code> Contributors: Kai Battistoni, Joey Ruffing, Ethan Claybourn, Abram Easthan, Chayse Collins</code>
_____


<p>This C++ application allows users to intuitively track their lineage and familial relationships visually.   


Compile with command : <code>make clean && make</code>
Run with command : <code>./family_tree.prog --server</code>

To use the local browser interface, run the server and open
<code>http://127.0.0.1:8080</code> (do not open <code>client/index.html</code> as a file).
The interface reads and updates the C++ <code>person</code>
objects directly.
Note: Use <code>./family_tree.prog --server 8090</code> to choose another port.

The map starts empty. Use the plus button to add the first person, then select
any person to edit them or add a sibling, parent, child, or spouse branch.

Birthday inputs and gender are optional; when provided, the calendar value influences
relative mass, and gender defines sphere color. The graph uses connected family
systems with parent-centered child orbits.
Use Save map to create a named <code>.save</code> file, and choose one from the
startup 'loading' dialog when reopening the server.
The person editor also individuals'
relationships and data to be edited manually. Use the add button below the graph to
create a disconnected person. FamilyTree provides plaintext persistence through
<code>save("treename")</code> and <code>load("treename")</code>, which use
<code>treename.save</code>. Changes are otherwise held in memory until the server stops.</p>

This Branch is Joey's Branch

___
[*Email*](kb877325@ohio.edu)
