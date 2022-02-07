module.exports = {
	"$id": "https://sockethub.org/schemas/v0/activity-stream#",
	"description": "schema for Sockethub Activity Streams",
	"type": "object",
	"required": [
		"context",
		"type",
		"actor"
	],
	"properties": {
		"id": {
			"type": "string"
		},
		"type": {
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
				},
				{
					"$ref": "#/definitions/type/attendance"
				},
				{
					"$ref": "#/definitions/type/presence"
				},
				{
					"$ref": "#/definitions/type/topic"
				},
				{
					"$ref": "#/definitions/type/address"
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
				},
				{
					"$ref": "#/definitions/type/attendance"
				},
				{
					"$ref": "#/definitions/type/presence"
				},
				{
					"$ref": "#/definitions/type/topic"
				},
				{
					"$ref": "#/definitions/type/address"
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
				},
				{
					"$ref": "#/definitions/type/attendance"
				},
				{
					"$ref": "#/definitions/type/presence"
				},
				{
					"$ref": "#/definitions/type/topic"
				},
				{
					"$ref": "#/definitions/type/address"
				}
			]
		}
	},
	"definitions": {
		"type": {
			"credentials": {
				"required": [
					"type"
				],
				"additionalProperties": true,
				"properties": {
					"type": {
						"enum": [
							"credentials"
						]
					}
				}
			},
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
			"message": {
				"required": [
					"type",
					"content"
				],
				"additionalProperties": true,
				"properties": {
					"type": {
						"enum": [
							"message"
						]
					},
					"id": {
						"type": "string"
					},
					"name": {
						"type": "string"
					},
					"content": {
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
			},
			"attendance": {
				"required": [
					"type"
				],
				"additionalProperties": false,
				"properties": {
					"type": {
						"enum": [
							"attendance"
						]
					},
					"members": {
						"type": "array",
						"items": {
							"type": "string"
						}
					}
				}
			},
			"presence": {
				"required": [
					"type",
					"presence"
				],
				"additionalProperties": false,
				"properties": {
					"type": {
						"enum": [
							"presence"
						]
					},
					"presence": {
						"enum": [
							"offline",
							"unavailable",
							"online"
						]
					},
					"content": {
						"type": "string"
					}
				}
			},
			"topic": {
				"required": [
					"type"
				],
				"additionalProperties": false,
				"properties": {
					"type": {
						"enum": [
							"topic"
						]
					},
					"content": {
						"type": "string"
					}
				}
			},
			"address": {
				"required": [
					"type"
				],
				"additionalProperties": false,
				"properties": {
					"type": {
						"enum": [
							"address"
						]
					}
				}
			}
		}
	}
};