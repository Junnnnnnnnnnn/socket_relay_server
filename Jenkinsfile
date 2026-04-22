pipeline {
    agent any
    environment {
        DOCKER_SERVICE_NAME = "${env.DOCKER_SERVICE_NAME}"
        ENV = "${env.ENV}"
    }
    stages {
        stage('Get Git Info') {
            steps {
                script {
                    def commitMessage = bat(
                        script: '@echo off && git log -1 --pretty=%%B',
                        returnStdout: true
                    ).trim()

                    def branchName = bat(
                        script: '@echo off && git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()

                    env.GIT_COMMIT_MESSAGE = commitMessage
                    env.GIT_BRANCH = branchName
                }
            }
        }

        stage('Build and Run Docker Compose') {
            steps {
                script {
                    bat """
                    cd
                    set NODE_ENV=${ENV}
                    docker-compose up -d --build ${DOCKER_SERVICE_NAME}
                    """
                }
            }
        }


        stage('Cleanup Docker Resources') {
            steps {
                script {
                    // 불필요한 Docker 리소스 정리
                    bat """
                    docker system prune -a -f
                    docker volume prune -f
                    """
                }
            }
        }
    }
    post {
        success {
            slackSend (
                color: '#36a64f', // 초록색
                message: """
                    *Build Success*
                    *Job:* `${env.JOB_NAME}`
                    *Build Number:* #${env.BUILD_NUMBER}
                    <${env.BUILD_URL}|View Build>
                    Branch: `${env.GIT_BRANCH}`
                    Commit: `${env.GIT_COMMIT_MESSAGE}`
                    """
            )
        }
        failure {
            slackSend (
                color: '#FF0000', // 빨간색
                message: """
                    *Build Failed*
                    *Job:* `${env.JOB_NAME}`
                    *Build Number:* #${env.BUILD_NUMBER}
                    <${env.BUILD_URL}|View Build>
                    Branch: `${env.GIT_BRANCH}`
                    Commit: `${env.GIT_COMMIT_MESSAGE}`
                    """
            )
        }
    }
}