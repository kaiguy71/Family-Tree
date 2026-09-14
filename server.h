#ifndef SERVER_H
#define SERVER_H

#include "family_tree.h"

/**
 * @brief Runs the loopback HTTP server for the family tree application.
 * @param tree Family tree instance modified by API requests.
 * @param port TCP port on which the server listens.
 * @return Non-zero when the server cannot create, bind, or listen on its socket.
 */
int runServer(FamilyTree& tree, int port);

#endif