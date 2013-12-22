##
# This file is part of node-redis-pool
#
# © 2013 Nick Jennings (https://github.com/silverbucket)
#
# licensed under the AGPLv3.
# See the LICENSE file for details.
#
# The latest version of sockethub-client can be found here:
#		https://github.com/silverbucket/node-redis-pool
#
# For more information about sockethub visit http://sockethub.org/.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#
#

BUILD_OPTIONS = -o baseUrl=lib

default: doc

doc:
	naturaldocs -i lib/ -o html doc/gh-pages/ -p doc/gh-pages/.config

.PHONY: default doc
