# Family Tree Application
*Ohio University Computer Science 2026*
_____
<code> Contributors: Kai Battistoni, Joey, Ethan, Abram, Chayse </code>


<p>This C++ application allows users to intuitively track their lineage and familial relationships visually.   


Compile with command : <code>make clean && make</code>
Run with command : <code>./family_tree.prog</code>

To use the local browser interface, run <code>./family_tree.prog --server</code> and open
<code>http://127.0.0.1:8080</code> (do not open <code>client/index.html</code> as a file).
The interface reads and updates the C++ <code>person</code>
objects directly.
Note: Use <code>./family_tree.prog --server 8090</code> to choose another port.

The map starts empty. Use the plus button to add the first person, then select
any person to edit them or add a sibling, parent, child, or spouse branch. Birthday
Birthday inputs and gender are optional; when provided, the calendar value affects
relative mass and gender controls sphere color. The graph uses connected family
systems with parent-centered child orbits and viewport-scaled mass.
Use Save map to create a named <code>.save</code> file, and choose one from the
startup load dialog when reopening the server.
The selected-person editor also allows parent and spouse
relationships to be corrected manually. Use the centered add button below the graph to
create a disconnected person. FamilyTree provides plaintext persistence through
<code>save("treename")</code> and <code>load("treename")</code>, which use
<code>treename.save</code>. Changes are otherwise held in memory until the server stops.</p>


[*Email*](kb877325@ohio.edu)