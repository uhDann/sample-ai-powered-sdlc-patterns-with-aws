"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const cdk_nag_1 = require("cdk-nag");
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create IAM role for domain analyzer Lambda function with least-privilege permissions
        const domainAnalyzerRole = new iam.Role(this, 'DomainAnalyzerLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'IAM role for domain analyzer Lambda function with least-privilege Bedrock and S3 access'
        });
        // Add CloudWatch Logs permissions (minimum required for Lambda execution)
        domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
            ]
        }));
        // Bedrock agent permissions removed - Lambda functions now use direct model invocation
        // Add separate policy for model invocation with specific model
        domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel'
            ],
            resources: [
                `*`
            ]
        }));
        // S3 permissions removed - Lambda functions now return responses directly
        // Suppress cdk-nag warnings for IAM role policies
        cdk_nag_1.NagSuppressions.addResourceSuppressions(domainAnalyzerRole, [
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement) and Bedrock model access (cross-region inference profiles)',
                appliesTo: [
                    `Resource::arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`,
                    `Resource::arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/eu.anthropic.claude-3-7-sonnet-20250219-v1:0`
                ]
            }
        ], true);
        // Create domain analyzer Lambda function
        this.domainAnalyzerFunction = new lambda.Function(this, 'DomainAnalyzerFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'domain-analyzer.handler',
            code: lambda.Code.fromAsset('../domain-analyzer-lambda'),
            role: domainAnalyzerRole,
            timeout: cdk.Duration.minutes(5),
            memorySize: 1024,
            environment: {
                BEDROCK_REGION: process.env.BEDROCK_REGION || this.region,
                MODEL_ID: process.env.MODEL_ID || 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
                AUTH_REQUIRED: 'false' // Disable authentication for internal calls
            },
            description: 'Lambda function for domain model analysis using Bedrock Claude 3.7 Sonnet'
        });
        // Export Lambda function ARN for application use
        new cdk.CfnOutput(this, 'DomainAnalyzerFunctionArn', {
            value: this.domainAnalyzerFunction.functionArn,
            description: 'ARN of the domain analyzer Lambda function',
            exportName: `${this.stackName}-DomainAnalyzerFunctionArn`
        });
        new cdk.CfnOutput(this, 'DomainAnalyzerFunctionName', {
            value: this.domainAnalyzerFunction.functionName,
            description: 'Name of the domain analyzer Lambda function',
            exportName: `${this.stackName}-DomainAnalyzerFunctionName`
        });
        // Create IAM role for doc generator Lambda function with least-privilege permissions
        const docGeneratorRole = new iam.Role(this, 'DocGeneratorLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'IAM role for doc generator Lambda function with minimal Bedrock access'
        });
        // Add CloudWatch Logs permissions (minimum required for Lambda execution)
        docGeneratorRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
            ]
        }));
        // Add minimal Bedrock permissions for model invocation only
        docGeneratorRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel'
            ],
            resources: [
                `*`
            ]
        }));
        // S3 permissions removed - Lambda functions now return responses directly
        // Create doc generator Lambda function
        this.docGeneratorFunction = new lambda.Function(this, 'DocGeneratorFunction', {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'doc-gen.handler',
            code: lambda.Code.fromAsset('../doc-gen-lambda'),
            role: docGeneratorRole,
            timeout: cdk.Duration.minutes(5),
            memorySize: 1024,
            environment: {
                BEDROCK_REGION: process.env.BEDROCK_REGION || this.region,
                MODEL_ID: process.env.MODEL_ID || 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
                AUTH_REQUIRED: 'false' // Disable authentication for internal calls
            },
            description: 'Lambda function for API documentation generation using Bedrock Claude 3.7 Sonnet'
        });
        // Suppress cdk-nag warnings for doc generator IAM role policies
        cdk_nag_1.NagSuppressions.addResourceSuppressions(docGeneratorRole, [
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement) and Bedrock model access (cross-region inference profiles)',
                appliesTo: [
                    `Resource::arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`,
                    `Resource::arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/eu.anthropic.claude-3-7-sonnet-20250219-v1:0`
                ]
            }
        ], true);
        // Export doc generator Lambda function ARN for application use
        new cdk.CfnOutput(this, 'DocGeneratorFunctionArn', {
            value: this.docGeneratorFunction.functionArn,
            description: 'ARN of the doc generator Lambda function',
            exportName: `${this.stackName}-DocGeneratorFunctionArn`
        });
        new cdk.CfnOutput(this, 'DocGeneratorFunctionName', {
            value: this.docGeneratorFunction.functionName,
            description: 'Name of the doc generator Lambda function',
            exportName: `${this.stackName}-DocGeneratorFunctionName`
        });
        // Backend functionality is now handled by the MCP server ECS service
    }
}
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxpREFBaUQ7QUFDakQsMkNBQTJDO0FBRTNDLHFDQUEwQztBQU0xQyxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUl4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVGQUF1RjtRQUN2RixNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDeEUsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELFdBQVcsRUFBRSx5RkFBeUY7U0FDdkcsQ0FBQyxDQUFDO1FBRUgsMEVBQTBFO1FBQzFFLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDckQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQixzQkFBc0I7Z0JBQ3RCLG1CQUFtQjthQUNwQjtZQUNELFNBQVMsRUFBRTtnQkFDVCxnQkFBZ0IsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTywwQkFBMEI7YUFDdEU7U0FDRixDQUFDLENBQUMsQ0FBQztRQUVKLHVGQUF1RjtRQUV2RiwrREFBK0Q7UUFDL0Qsa0JBQWtCLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNyRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7YUFDdEI7WUFDRCxTQUFTLEVBQUU7Z0JB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SUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsV0FBVztZQUM1QyxXQUFXLEVBQUUsMENBQTBDO1lBQ3ZELFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDBCQUEwQjtTQUN4RCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWTtZQUM3QyxXQUFXLEVBQUUsMkNBQTJDO1lBQ3hELFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDJCQUEyQjtTQUN6RCxDQUFDLENBQUM7UUFFSCxxRUFBcUU7SUFDdkUsQ0FBQztDQUNGO0FBaktELGtDQWlLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5hZ1N1cHByZXNzaW9ucyB9IGZyb20gJ2Nkay1uYWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGtub3dsZWRnZUJhc2VJZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIExhbWJkYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRvbWFpbkFuYWx5emVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGRvY0dlbmVyYXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgZG9tYWluIGFuYWx5emVyIExhbWJkYSBmdW5jdGlvbiB3aXRoIGxlYXN0LXByaXZpbGVnZSBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGRvbWFpbkFuYWx5emVyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRG9tYWluQW5hbHl6ZXJMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciBkb21haW4gYW5hbHl6ZXIgTGFtYmRhIGZ1bmN0aW9uIHdpdGggbGVhc3QtcHJpdmlsZWdlIEJlZHJvY2sgYW5kIFMzIGFjY2VzcydcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnMgKG1pbmltdW0gcmVxdWlyZWQgZm9yIExhbWJkYSBleGVjdXRpb24pXG4gICAgZG9tYWluQW5hbHl6ZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2xhbWJkYS8qYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEJlZHJvY2sgYWdlbnQgcGVybWlzc2lvbnMgcmVtb3ZlZCAtIExhbWJkYSBmdW5jdGlvbnMgbm93IHVzZSBkaXJlY3QgbW9kZWwgaW52b2NhdGlvblxuXG4gICAgLy8gQWRkIHNlcGFyYXRlIHBvbGljeSBmb3IgbW9kZWwgaW52b2NhdGlvbiB3aXRoIHNwZWNpZmljIG1vZGVsXG4gICAgZG9tYWluQW5hbHl6ZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGAqYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIFMzIHBlcm1pc3Npb25zIHJlbW92ZWQgLSBMYW1iZGEgZnVuY3Rpb25zIG5vdyByZXR1cm4gcmVzcG9uc2VzIGRpcmVjdGx5XG5cbiAgICAvLyBTdXBwcmVzcyBjZGstbmFnIHdhcm5pbmdzIGZvciBJQU0gcm9sZSBwb2xpY2llc1xuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyhkb21haW5BbmFseXplclJvbGUsIFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdBd3NTb2x1dGlvbnMtSUFNNScsXG4gICAgICAgIHJlYXNvbjogJ1dpbGRjYXJkIHBlcm1pc3Npb25zIGFyZSBuZWNlc3NhcnkgZm9yIENsb3VkV2F0Y2ggTG9ncyAoTGFtYmRhIHJ1bnRpbWUgcmVxdWlyZW1lbnQpIGFuZCBCZWRyb2NrIG1vZGVsIGFjY2VzcyAoY3Jvc3MtcmVnaW9uIGluZmVyZW5jZSBwcm9maWxlcyknLFxuICAgICAgICBhcHBsaWVzVG86IFtcbiAgICAgICAgICBgUmVzb3VyY2U6OmFybjphd3M6bG9nczoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgLFxuICAgICAgICAgIGBSZXNvdXJjZTo6YXJuOmF3czpiZWRyb2NrOio6JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlL2V1LmFudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYFxuICAgICAgICBdXG4gICAgICB9XG4gICAgXSwgdHJ1ZSk7XG5cbiAgICAvLyBDcmVhdGUgZG9tYWluIGFuYWx5emVyIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMuZG9tYWluQW5hbHl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RvbWFpbkFuYWx5emVyRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdkb21haW4tYW5hbHl6ZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2RvbWFpbi1hbmFseXplci1sYW1iZGEnKSxcbiAgICAgIHJvbGU6IGRvbWFpbkFuYWx5emVyUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJFRFJPQ0tfUkVHSU9OOiBwcm9jZXNzLmVudi5CRURST0NLX1JFR0lPTiB8fCB0aGlzLnJlZ2lvbixcbiAgICAgICAgTU9ERUxfSUQ6IHByb2Nlc3MuZW52Lk1PREVMX0lEIHx8ICd1cy5hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MCcsXG4gICAgICAgIEFVVEhfUkVRVUlSRUQ6ICdmYWxzZScgLy8gRGlzYWJsZSBhdXRoZW50aWNhdGlvbiBmb3IgaW50ZXJuYWwgY2FsbHNcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBmb3IgZG9tYWluIG1vZGVsIGFuYWx5c2lzIHVzaW5nIEJlZHJvY2sgQ2xhdWRlIDMuNyBTb25uZXQnXG4gICAgfSk7XG5cblxuXG4gICAgLy8gRXhwb3J0IExhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIGFwcGxpY2F0aW9uIHVzZVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb21haW5BbmFseXplckZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZG9tYWluQW5hbHl6ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVJOIG9mIHRoZSBkb21haW4gYW5hbHl6ZXIgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb21haW5BbmFseXplckZ1bmN0aW9uQXJuYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RvbWFpbkFuYWx5emVyRnVuY3Rpb25OYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZG9tYWluQW5hbHl6ZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIGRvbWFpbiBhbmFseXplciBMYW1iZGEgZnVuY3Rpb24nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURvbWFpbkFuYWx5emVyRnVuY3Rpb25OYW1lYFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlIGZvciBkb2MgZ2VuZXJhdG9yIExhbWJkYSBmdW5jdGlvbiB3aXRoIGxlYXN0LXByaXZpbGVnZSBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGRvY0dlbmVyYXRvclJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0RvY0dlbmVyYXRvckxhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSUFNIHJvbGUgZm9yIGRvYyBnZW5lcmF0b3IgTGFtYmRhIGZ1bmN0aW9uIHdpdGggbWluaW1hbCBCZWRyb2NrIGFjY2VzcydcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnMgKG1pbmltdW0gcmVxdWlyZWQgZm9yIExhbWJkYSBleGVjdXRpb24pXG4gICAgZG9jR2VuZXJhdG9yUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9sYW1iZGEvKmBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgbWluaW1hbCBCZWRyb2NrIHBlcm1pc3Npb25zIGZvciBtb2RlbCBpbnZvY2F0aW9uIG9ubHlcbiAgICBkb2NHZW5lcmF0b3JSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGAqYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIFMzIHBlcm1pc3Npb25zIHJlbW92ZWQgLSBMYW1iZGEgZnVuY3Rpb25zIG5vdyByZXR1cm4gcmVzcG9uc2VzIGRpcmVjdGx5XG5cbiAgICAvLyBDcmVhdGUgZG9jIGdlbmVyYXRvciBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLmRvY0dlbmVyYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRG9jR2VuZXJhdG9yRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdkb2MtZ2VuLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9kb2MtZ2VuLWxhbWJkYScpLFxuICAgICAgcm9sZTogZG9jR2VuZXJhdG9yUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJFRFJPQ0tfUkVHSU9OOiBwcm9jZXNzLmVudi5CRURST0NLX1JFR0lPTiB8fCB0aGlzLnJlZ2lvbixcbiAgICAgICAgTU9ERUxfSUQ6IHByb2Nlc3MuZW52Lk1PREVMX0lEIHx8ICd1cy5hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MCcsXG4gICAgICAgIEFVVEhfUkVRVUlSRUQ6ICdmYWxzZScgLy8gRGlzYWJsZSBhdXRoZW50aWNhdGlvbiBmb3IgaW50ZXJuYWwgY2FsbHNcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBmb3IgQVBJIGRvY3VtZW50YXRpb24gZ2VuZXJhdGlvbiB1c2luZyBCZWRyb2NrIENsYXVkZSAzLjcgU29ubmV0J1xuICAgIH0pO1xuXG5cblxuICAgIC8vIFN1cHByZXNzIGNkay1uYWcgd2FybmluZ3MgZm9yIGRvYyBnZW5lcmF0b3IgSUFNIHJvbGUgcG9saWNpZXNcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoZG9jR2VuZXJhdG9yUm9sZSwgW1xuICAgICAge1xuICAgICAgICBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JyxcbiAgICAgICAgcmVhc29uOiAnV2lsZGNhcmQgcGVybWlzc2lvbnMgYXJlIG5lY2Vzc2FyeSBmb3IgQ2xvdWRXYXRjaCBMb2dzIChMYW1iZGEgcnVudGltZSByZXF1aXJlbWVudCkgYW5kIEJlZHJvY2sgbW9kZWwgYWNjZXNzIChjcm9zcy1yZWdpb24gaW5mZXJlbmNlIHByb2ZpbGVzKScsXG4gICAgICAgIGFwcGxpZXNUbzogW1xuICAgICAgICAgIGBSZXNvdXJjZTo6YXJuOmF3czpsb2dzOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTpsb2ctZ3JvdXA6L2F3cy9sYW1iZGEvKmAsXG4gICAgICAgICAgYFJlc291cmNlOjphcm46YXdzOmJlZHJvY2s6Kjoke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvZXUuYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjBgXG4gICAgICAgIF1cbiAgICAgIH1cbiAgICBdLCB0cnVlKTtcblxuICAgIC8vIEV4cG9ydCBkb2MgZ2VuZXJhdG9yIExhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIGFwcGxpY2F0aW9uIHVzZVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2NHZW5lcmF0b3JGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvY0dlbmVyYXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gb2YgdGhlIGRvYyBnZW5lcmF0b3IgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb2NHZW5lcmF0b3JGdW5jdGlvbkFybmBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2NHZW5lcmF0b3JGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kb2NHZW5lcmF0b3JGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIGRvYyBnZW5lcmF0b3IgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb2NHZW5lcmF0b3JGdW5jdGlvbk5hbWVgXG4gICAgfSk7XG5cbiAgICAvLyBCYWNrZW5kIGZ1bmN0aW9uYWxpdHkgaXMgbm93IGhhbmRsZWQgYnkgdGhlIE1DUCBzZXJ2ZXIgRUNTIHNlcnZpY2VcbiAgfVxufSJdfQ==