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

default: prepdoc doc commitdoc

prepdoc:
	cd doc/gh-pages/
	git checkout gh-pages
	cd ../../

doc:
	naturaldocs -i lib/ -o html doc/gh-pages/ -p doc/gh-pages/.config

doc-rebuild:
	naturaldocs -i lib/ -r -o html doc/gh-pages/ -p doc/gh-pages/.config
	
commitdoc:
	cd doc/gh-pages/
	git add *
	git commit -m "update api docs" .
	git push
	git checkout gh-pages
	cd ../../

.PHONY: default doc
