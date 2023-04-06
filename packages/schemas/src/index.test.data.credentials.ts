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
    'credentials with invalid prop names',
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
    `[test-platform] /object: must NOT have additional properties: pass`
  ],

  [
    'credentials with missing prop',
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
    `[test-platform] /object: must have required property 'host'`
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
];
