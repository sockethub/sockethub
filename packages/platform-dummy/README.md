# @sockethub/platform-dummy

A Sockethub test platform for development and testing purposes.

## About

This platform provides basic testing functionality for Sockethub development. It implements
simple verbs that can be used to test ActivityStreams message flow, error handling, and
platform communication without requiring external service connections.

## Implemented Verbs (`@type`)

* **echo** - Returns the received message unchanged
* **fail** - Intentionally fails with an error message
* **throw** - Throws an exception for testing error handling
* **greet** - Returns a greeting message

## Usage

### Echo Example

```json
{
  "@type": "echo",
  "context": "dummy",
  "actor": {
    "@id": "test-user"
  },
  "object": {
    "content": "Hello World"
  }
}
```

### Response

```json
{
  "@type": "echo",
  "context": "dummy",
  "actor": {
    "@id": "test-user"
  },
  "object": {
    "content": "Hello World"
  }
}
```

## Use Cases

* **Development testing**: Test ActivityStreams message processing
* **Integration testing**: Verify platform loading and communication
* **Error handling**: Test error scenarios and exception handling
* **Learning**: Understand Sockethub platform structure and ActivityStreams format
