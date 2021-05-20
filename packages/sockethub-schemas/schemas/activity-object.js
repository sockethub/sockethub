module.exports = {
	"id": "http://sockethub.org/schemas/v0/activity-object#",
	"$schema": "http://json-schema.org/draft-04/schema#",
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
					"$ref": "http://sockethub.org/schemas/v0/activity-stream#/definitions/type/feed"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-stream#/definitions/type/person"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-stream#/definitions/type/room"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-stream#/definitions/type/website"
				}
			]
		}
	},
	"definitions": {
		"type": {
			"feed": {
				"activity-object": true,
				"required": [
					"@id",
					"@type"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string",
						"format": "uri"
					},
					"@type": {
						"enum": [
							"feed"
						]
					},
					"displayName": {
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
				"activity-object": true,
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string",
						"format": "uri"
					},
					"@type": {
						"enum": [
							"person"
						]
					},
					"displayName": {
						"type": "string"
					}
				}
			},
			"room": {
				"activity-object": true,
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string",
						"format": "uri"
					},
					"@type": {
						"enum": [
							"room"
						]
					},
					"displayName": {
						"type": "string"
					}
				}
			},
			"website": {
				"activity-object": true,
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string",
						"format": "uri"
					},
					"@type": {
						"enum": [
							"website"
						]
					},
					"displayName": {
						"type": "string"
					}
				}
			}
		}
	}
};