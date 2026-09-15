# Family Tree Application — Project Specifications

**Project:** Ohio University CS3560 Family Tree  
**Version:** 1.0  
**Date:** September 15, 2026  
**Basis:** Current repository source code. This document describes implemented behavior; limitations and acceptance checks are identified separately.

## 1. Purpose and scope

The application lets a user record people and familial relationships, explore them through an interactive graph, and save or reopen a family tree locally. It supports multiple disconnected families within one map.

The intended user runs the application on their own computer and accesses its browser interface. Accounts, cloud synchronization, collaborative editing, genealogical research services, and standard genealogy import/export formats are outside the current scope.

## 2. Runtime and build requirements

| Component | Requirement |
| --- | --- |
| Backend | C++17 compiler, such as `g++`, and Make |
| Operating environment | POSIX socket APIs and C++17 filesystem support; the source targets a Unix-like environment |
| Browser | JavaScript enabled; support for Fetch, SVG, HTML dialogs, pointer events, and animation frames |
| Storage | Permission to read and write save files in the selected location |
| Working directory | Run from the project root so the server can find `client/` and list local save files |
| Network | Available loopback TCP port; default `8080` |

Build and launch:

```bash
make
./family_tree.prog --server
```

Open `http://127.0.0.1:8080` in the browser. An optional port can be supplied with `./family_tree.prog --server 8090`. Opening `client/index.html` directly does not provide the backend connection.

Running the executable without `--server` displays the initially empty tree in the console; it does not open an interactive console editor or automatically load a save file.

## 3. Architecture

| File or directory | Responsibility |
| --- | --- |
| `main.cpp` | Constructs the tree and selects server or console mode |
| `person.h`, `person.cpp` | Person identity, attributes, relationship operations, and console display |
| `family_tree.h`, `family_tree.cpp` | Ownership of people, lookup, creation, removal, and persistence |
| `server.h`, `server.cpp` | Local HTTP server, API routing, and static client delivery |
| `client/index.html` | Map interface, person editor, and create/save/load dialogs |
| `client/app.js` | API requests, graph layout and animation, navigation, and form behavior |
| `client/style.css` | Interface styling |
| `Makefile` | Builds `family_tree.prog` with C++17 and compiler warnings |
| `Doxyfile`, `html/`, `latex/` | Doxygen configuration and existing generated documentation |

The browser communicates with the C++ server over HTTP. The server maintains one in-memory `FamilyTree` and processes client connections sequentially. `FamilyTree` owns people through `std::unique_ptr`; relationships use non-owning pointers. Browser positions and selection state are separate from the stored family data.

## 4. Functional requirements

| ID | Requirement and current behavior |
| --- | --- |
| FR-01 | Start with an empty in-memory tree. Offer a load dialog on browser startup when local `.save` files exist. |
| FR-02 | Create an unrelated person using the first-person button or the disconnected-person button. A name is required by the UI and API; birthday and gender are optional. |
| FR-03 | Select a person to inspect and edit their name, birthday, gender, father, mother, and spouse selection. |
| FR-04 | Create a father, mother, child, sibling, or spouse from a selected person. A sibling inherits the selected person's existing parents. If neither parent exists, no sibling link is created. |
| FR-05 | Assign or remove existing parent and spouse relationships. Parent changes update the corresponding child lists; spouse links are reciprocal. |
| FR-06 | Remove a person after browser confirmation and disconnect their relationships without deleting the remaining relatives. |
| FR-07 | Clear the in-memory map after browser confirmation. Existing save files remain available. |
| FR-08 | Display people as labeled graph nodes with relationship connections, gender-based styling, and an animated layout. Support selecting and dragging nodes, panning, and wheel zoom. |
| FR-09 | Save the current tree to a named plaintext `.save` file. Reusing a filename overwrites that file. |
| FR-10 | Load a selected save file and replace the active tree. Restore person attributes and relationships. |
| FR-11 | Show API error messages in the interface status area. Log failed HTTP responses to standard error. |

### Relationship rules

- Each person has at most one father and one mother, plus lists of children and spouses.
- Parent roles are independent of the person's gender value.
- Self-parent and self-spouse links are ignored by the domain methods. Duplicate child and spouse entries are avoided.
- Siblings are derived from sharing at least one known parent; there is no separately stored sibling relationship.
- Creating a child through the current branch button assigns the selected person as the father. The API supports either parent role.
- The model supports multiple spouses, but the editor offers one spouse selection. Saving that editor removes spouses other than the selected one.
- Full ancestry-cycle validation and comprehensive relationship-consistency checks are not implemented.

## 5. Data model

| Field | Representation | Meaning |
| --- | --- | --- |
| `id` | C++ `long`; JSON number | Immutable identifier assigned by a process-wide increasing counter |
| `name` | String | Display name; the API rejects an empty string |
| `birthday` | String | Optional date; the browser sends `MM-DD-YYYY` and uses `YYYY-MM-DD` in date inputs |
| `gender` | Enum / string | `unknown`, `male`, or `female`; unrecognized API values become `unknown` |
| `father`, `mother` | Pointer; JSON ID or `null` | Parent references |
| `children`, `spouses` | Pointer lists; JSON ID arrays | Related people |
| `siblings` | Derived JSON ID array | People sharing a known father or mother |

The backend stores birthday text without validating calendar correctness. Identifiers are unique within the running process, but are regenerated when loading a file; saved IDs are used to reconstruct relationships, not preserved as permanent identity values.

## 6. HTTP API

The base URL is `http://127.0.0.1:8080` by default. Requests with bodies use JSON. The current string parser expects compact properties such as `"name":"Alex"`; it is not a general-purpose JSON parser.

| Method | Path | Input | Successful response |
| --- | --- | --- | --- |
| GET | `/api/people` | None | Array of person objects with all fields from Section 5 |
| POST | `/api/people` | `name`; optional `birthday`, `gender`, `relation`, `relatedId`, `role` | `{"id":number}` |
| PATCH or PUT | `/api/people` | `id`, `name`, `birthday`, `gender` | `{"ok":true}` |
| DELETE | `/api/people?id=ID` | Person ID in query | `{"ok":true}` |
| DELETE | `/api/people` | None | `{"ok":true}`; clears all people |
| POST | `/api/relationships` | `childId`, `parentId`, `role` (`father` or `mother`) | `{"ok":true}` |
| DELETE | `/api/relationships?childId=ID&role=ROLE` | Child ID and parent role | `{"ok":true}` |
| POST | `/api/marriages` | `firstId`, `secondId` | `{"ok":true}` |
| DELETE | `/api/marriages?firstId=ID&secondId=ID` | Two person IDs | `{"ok":true}` |
| GET | `/api/savefiles` | None | Array of `.save` filenames in the working directory |
| POST | `/api/save` | `treename` | `{"ok":true}` |
| POST | `/api/load` | `treename` | `{"ok":true}` |

Successful API operations return HTTP 200. Validation and save/load failures generally return HTTP 400 with `{"error":"message"}`. Removing a nonexistent person returns HTTP 404. The server also serves the browser's static files.

For related-person creation, `relation` may be `parent`, `child`, `sibling`, or `spouse`, and `relatedId` must identify an existing person. A parent creation uses father when `role` is `father`, otherwise mother; child creation uses mother when `role` is `mother`, otherwise father.

Despite accepting PATCH, person updates replace name, birthday, and gender together. Omitting birthday or gender clears the birthday or resets gender to unknown. The browser supplies all three values.

## 7. Persistence specification

Save files contain one person per line:

```text
id "name" "birthday" "gender" fatherId motherId spouseCount spouseId...
```

Example of an unrelated person:

```text
0 "Alex Doe" "04-12-1990" "unknown" -1 -1 0
```

- String fields use C++ quoted-string formatting. Missing parents use `-1`.
- The filename receives a `.save` suffix unless it already has one.
- Child lists are reconstructed from parent references; siblings are derived.
- The loader also accepts the older record format without a gender field, defaulting gender to unknown.
- The loader parses records before clearing the current tree. A missing file or a record parsing failure returns false before replacement.
- References to IDs absent from the loaded records are skipped. Duplicate saved IDs and other semantic inconsistencies are not comprehensively validated.
- Node coordinates, zoom, pan, selection, and animation state are not saved.
- Changes stay in memory until explicitly saved. Saving is not automatic or transactional, and loading replaces unsaved in-memory data.

## 8. Operational constraints and known limitations

- **Local operation:** The server binds to IPv4 loopback. Authentication, encrypted transport, and multi-user coordination are not implemented.
- **HTTP handling:** Requests use a single receive call with a 16,384-byte buffer. Complete handling of fragmented or larger requests is not implemented.
- **Input handling:** JSON parsing and escaping are limited. General JSON formatting, escaped input strings, and all control characters are not fully supported.
- **File handling:** Static-file and save/load paths do not have comprehensive path validation. The current implementation is a local project application, not a production hosting service.
- **Editing consistency:** Attribute and relationship changes are separate API calls; a failed later request can leave earlier edits applied.
- **Visualization:** The layout is a family graph, not a fixed pedigree chart. Generation depth affects node size. The README describes birthday-based relative mass, but current size and collision calculations use generation depth; birthday-based mass is not an established feature.
- **Capacity:** No maximum supported tree size or measured performance target is defined. Animation performs pairwise node calculations and repeated relationship traversal.
- **Accessibility and portability:** Forms include labels and some accessible button names, but complete keyboard graph navigation, accessibility compliance, and cross-browser support have not been verified.

## 9. Acceptance checks

These checks define a manual verification checklist; they are not a claim that runtime testing was performed for this document.

| ID | Scenario | Expected result |
| --- | --- | --- |
| AC-01 | Build with `make`, start server, and open the loopback URL | Application loads with an empty map in a fresh process |
| AC-02 | Add a person with only a name | Person appears with an empty birthday and unknown gender |
| AC-03 | Add parents, a child, and a spouse | Corresponding graph connections and reciprocal relationship data appear |
| AC-04 | Add a sibling to a person with known parents | The new person shares those parents and is included in derived sibling data |
| AC-05 | Edit attributes and change or clear a parent | Updated attributes and child/parent references are returned by the API |
| AC-06 | Remove a person, then clear the map | Remaining relatives survive person removal; clearing leaves zero people |
| AC-07 | Save, restart the server, and choose the saved tree | Names, birthdays, genders, and relationships are restored; IDs and positions may differ |
| AC-08 | Submit an empty name or load a nonexistent file | API reports an error; the failed load leaves the active tree intact |
| AC-09 | Pan, drag, and zoom a map with disconnected families | Graph remains navigable and person selection opens the editor |

## 10. Source references

This specification was checked against [README.md](README.md), [main.cpp](main.cpp), [person.h](person.h), [person.cpp](person.cpp), [family_tree.h](family_tree.h), [family_tree.cpp](family_tree.cpp), [server.cpp](server.cpp), [client/index.html](client/index.html), [client/app.js](client/app.js), and [Makefile](Makefile).
