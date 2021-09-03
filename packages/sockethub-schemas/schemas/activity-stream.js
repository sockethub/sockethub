module.exports = {
	"$id": "https://sockethub.org/schemas/v0/activity-stream#",
	"description": "schema for Sockethub Activity Streams",
	"type": "object",
	"required": [
		"context",
		"@type",
		"actor"
	],
	"properties": {
		"@id": {
			"type": "string"
		},
		"@type": {
			"type": "string"
		},
		"context": {
			"type": "string"
		},
		"actor": {
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
		},
		"target": {
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
		},
		"object": {
			"type": "object",
			"oneOf": [
				{
					"$ref": "#/definitions/type/credentials"
				},
				{
					"$ref": "#/definitions/type/feed"
				},
				{
					"$ref": "#/definitions/type/message"
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
						"type": "string",
						"format": "iri"
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
					"@type"
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
					"@type"
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
					"@type"
				],
				"additionalProperties": true,
				"properties": {
					"@id": {
						"type": "string",
						"format": "iri"
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