/**
 * This file is part of Sockethub.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * server is licensed under the LGPL.
 * See the LICENSE file for details.
 *
 * The latest version of server can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about Sockethub visit https://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

// this schema defines the general structure of the schema object which should
// be returned from platforms.
export const PlatformSchema = {
    $id: "https://sockethub.org/schemas/v/platform.json",
    type: "object",
    required: ["name", "version", "messages", "as2"],
    additionalProperties: false,
    properties: {
        as2: {
            title: "as2",
            type: "object",
            required: ["contextUrl", "contextVersion", "schemaVersion"],
            additionalProperties: false,
            properties: {
                contextUrl: {
                    type: "string",
                    format: "uri",
                },
                contextVersion: {
                    type: "string",
                },
                schemaVersion: {
                    type: "string",
                },
                messageConstraints: {
                    type: "object",
                },
            },
        },
        credentials: {
            title: "credentials",
            type: "object",
        },

        messages: {
            title: "messages",
            type: "object",
        },

        name: {
            title: "name",
            type: "string",
        },

        version: {
            title: "version",
            type: "string",
        },
    },
};
