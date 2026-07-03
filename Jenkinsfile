// monitoring_relay_bridge — Jenkins Pipeline
// 릴레이 서버(Node.js ws :8080) 이미지 빌드 → Harbor push → autonomous ns 배포.
// 빌드 관례는 ../AIBootcamp/Jenkinsfile 참고:
//   - agent any (에이전트 파드에 host docker + docker.sock + kubectl 가 hostPath 로 마운트됨)
//   - docker.withRegistry(..., 'harbor') 의 'harbor' 는 Jenkins 에 등록된 Harbor 크리덴셜 ID
pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(name: 'FORCE_DEPLOY', defaultValue: false,
                     description: '브랜치와 무관하게 강제로 빌드·푸시·배포')
    }

    environment {
        REGISTRY  = 'harbor.cu.ac.kr'
        PROJECT   = 'autonomousmonitoring'
        IMAGE     = 'relay-server'
        NAMESPACE = 'autonomous'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Build & Push') {
            when { anyOf { branch 'main'; expression { return params.FORCE_DEPLOY } } }
            steps {
                script {
                    // 컨텍스트 = 레포 루트(Dockerfile 위치)
                    def img = docker.build("${REGISTRY}/${PROJECT}/${IMAGE}:${IMAGE_TAG}", ".")
                    docker.withRegistry("https://${REGISTRY}", 'harbor') {
                        img.push()
                        img.push('latest')
                    }
                }
            }
        }

        stage('Deploy') {
            when { anyOf { branch 'main'; expression { return params.FORCE_DEPLOY } } }
            steps {
                dir('deploy/k8s') {
                    sh '''
                        set -e
                        # newTag: latest → BUILD_NUMBER (숫자만 들어가면 kustomize 가 int 로 파싱해
                        # 실패하므로 따옴표로 문자열 강제)
                        sed -i 's|newTag: latest|newTag: "'"${IMAGE_TAG}"'"|g' kustomization.yaml
                        kubectl apply -k .
                        kubectl rollout status deploy/relay-server -n ${NAMESPACE} --timeout=3m
                        echo "Relay NodePort: $(kubectl get svc relay-server -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}')"
                    '''
                }
            }
        }
    }
}
