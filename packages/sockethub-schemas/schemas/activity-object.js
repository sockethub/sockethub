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
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/credentials"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/feed"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/message"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/person"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/room"
				},
				{
					"$ref": "http://sockethub.org/schemas/v0/activity-object#/definitions/type/website"
				}
			]
		}
	},
	"definitions": {
		"type": {
			"credentials": {
				"required": [
					"@type"
				],
				"additionalProperties": true,
				"properties": {
					"@type": {
						"enum": [
							"credentials"
						]
					}
				}
			},
			"feed": {
				"required": [
					"@id",
					"@type"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string"
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
			"message": {
				"required": [
					"@type",
					"displayName",
					"content"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string"
					},
					"@type": {
						"enum": [
							"message"
						]
					},
					"displayName": {
						"type": "string"
					},
					"content": {
						"type": "string"
					}
				}
			},
			"person": {
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string"
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
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string"
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
				"required": [
					"@id",
					"@type",
					"displayName"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string"
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
}