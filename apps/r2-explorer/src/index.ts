import { R2Explorer } from 'r2-explorer'
({
  // Set to false to allow users to upload files
  readonly: false,
  basicAuth: {
    username: 'admin',
    password: 'password',
  },

  // Learn more how to secure your R2 Explorer instance:
  // https://r2explorer.com/getting-started/security/
  // cfAccessTeamName: "my-team-name",
})

export { R2Explorer }
