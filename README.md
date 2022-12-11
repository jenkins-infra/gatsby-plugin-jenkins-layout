# gatsby-plugin-jenkins-layout

Shared layout for jenkins.io based gatsby sites

## Usage

gatsby-config.js

```javascript
module.exports = {
    siteMetadata: {
        siteUrl: 'https://stories.jenkins.io',
        githubRepo: 'jenkins-infra/stories',
    },
    plugins: [
        {
            resolve: '../gatsby-plugin-jenkins-layout/',
            options: {
                siteUrl: 'https://stories.jenkins.io',
            },
        },
    ]
}
```
