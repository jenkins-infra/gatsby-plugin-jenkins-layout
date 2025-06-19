pipeline {
  options {
    timeout(time: 60, unit: 'MINUTES')
    ansiColor('xterm')
    disableConcurrentBuilds(abortPrevious: true)
    buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '5', numToKeepStr: '5')
  }

  agent {
    label 'linux-arm64-docker || arm64linux'
  }

  environment {
    NODE_ENV = 'production'
    TZ = "UTC"
  }

  stages {
    stage('Check for typos') {
      steps {
        sh 'typos --format sarif > typos.sarif || true'
      }
      post {
        always {
          recordIssues(tools: [sarif(id: 'typos', name: 'Typos', pattern: 'typos.sarif')])
        }
      }
    }

    stage('Install Dependencies') {
      environment {
        NODE_ENV = 'development'
      }
      steps {
        sh 'asdf install'
        sh 'npm ci'
      }
    }

    stage('Lint') {
      environment {
        NODE_ENV = "development"
      }
      steps {
        sh '''
          npx eslint --format checkstyle . > eslint-results.json || true
        '''
      }
      post {
        always {
          recordIssues(tools: [
              esLint(pattern: 'eslint-results.json'),
          ])
        }
      }
    }

    stage('Build') {
      steps {
        sh '''
          npm run build --if-present
        '''
      }
    }

    stage('Release') {
      when {
        allOf {
          anyOf {
            branch "main"
            branch "beta"
            branch "alpha"
          }
          // Only deploy to production from infra.ci.jenkins.io
          expression { infra.isInfra() }
        }
      }
      environment {
        NPM_TOKEN = credentials('jenkinsci-npm-token')
      }
      steps {
        script {
          withCredentials([usernamePassword(credentialsId: 'jenkins-io-components-ghapp',
                usernameVariable: 'GITHUB_APP',
                passwordVariable: 'GITHUB_TOKEN')]) {
            sh 'npx semantic-release --repositoryUrl https://x-access-token:$GITHUB_TOKEN@github.com/jenkins-infra/gatsby-plugin-jenkins-layout.git'
          }
        }
      }
    }
  }
}
