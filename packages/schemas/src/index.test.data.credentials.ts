export default [
  [
    'credentials with no context',
    {
      type: 'credentials',
      object: {
        type: 'credentials'
      }
    },
    false,
    `credential activity streams must have a context set`
  ],

  [
    'credentials with no type',
    {
      context: 'test-platform',
      object: {
        type: 'credentials'
      }
    },
    false,
    `credential activity streams must have credentials set as type`
  ],

  [
    'credentials with props',
    {
      context: 'test-platform',
      type: 'credentials',
      object: {
        type: 'credentials',
        user: "foo",
        pass: "bar"
      }
    },
    false,
    `/object: must NOT have additional properties`
  ],

  [
    'credentials with props',
    {
      context: 'test-platform',
      type: 'credentials',
      object: {
        type: 'credentials',
        username: "foo",
        password: "bar"
      }
    },
    false,
    `/object: must have required property 'host'`
  ],

  [
    'credentials with props',
    {
      context: 'test-platform',
      type: 'credentials',
      object: {
        type: 'credentials',
        username: "foo",
        password: "bar",
        host: 'yarg'
      }
    },
    true,
    ""
  ],
]
