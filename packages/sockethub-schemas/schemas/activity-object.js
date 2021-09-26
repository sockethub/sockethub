module.exports = {
	"$id": "https://sockethub.org/schemas/v0/activity-object#",
	"description": "schema for Sockethub Activity Objects",
	"type": "object",
	"required": [
		"object"
	],
	"properties": {
		"object": {
			"type": "object",
			"oneOf": [
				{
					"$ref": "#/definitions/type/feed"
				},
				{
					"$ref": "#/definitions/type/person"
				},
				{
					"$ref": "#/definitions/type/room"
				},
				{
					"$ref": "#/definitions/type/website"
				}
			]
		}
	},
	"definitions": {
		"type": {
			"feed": {
				"required": [
					"id",
					"type"
				],
				"additionalProperties": true,
				"properties": {
					"type": {
						"enum": [
							"feed"
						]
					},
					"id": {
						"type": "string",
						"format": "iri"
					},
					"name": {
						"type": "string"
					},
					"description": {
						"type": "string"
					},
					"author": {
						"type": "string"
					},
					"favicon": {
						"type": "string"
					}
				}
			},
			"person": {
				"required": [
					"id",
					"type"
				],
				"additionalProperties": true,
				"properties": {
					"id": {
						"type": "string"
					},
					"type": {
						"enum": [
							"person"
						]
					},
					"name": {
						"type": "string"
					}
				}
			},
			"room": {
				"required": [
					"id",
					"type"
				],
				"additionalProperties": true,
				"properties": {
					"id": {
						"type": "string"
					},
					"type": {
						"enum": [
							"room"
						]
					},
					"name": {
						"type": "string"
					}
				}
			},
			"website": {
				"required": [
					"id",
					"type"
				],
				"additionalProperties": true,
				"properties": {
					"id": {
						"type": "string",
						"format": "iri"
					},
					"type": {
						"enum": [
							"website"
						]
					},
					"name": {
						"type": "string"
					}
				}
			}
		}
	}
};