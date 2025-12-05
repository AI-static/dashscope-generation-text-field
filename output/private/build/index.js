"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const textGeneration_1 = require("./services/textGeneration");
const { t } = block_basekit_server_api_1.field;
// 添加飞书和阿里云域名到白名单
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, 'dashscope.aliyuncs.com']);
// 从服务层获取模型配置
const textModels = textGeneration_1.TextGenerationService.getSupportedModels();
block_basekit_server_api_1.basekit.addField({
    // 定义捷径的i18n语言资源
    i18n: {
        messages: {
            'zh-CN': {
                'model': '模型选择',
                'apiKey': 'API Key',
                'prompt': '输入prompt',
                'response': 'AI回复',
                'responseTime': '响应时间(ms)',
                'tokens': 'Token使用量',
                'enableThinking': '深度思考模式',
                'thinkingDesc': '让模型在回答前进行深入思考',
                'error': '错误信息',
                'selectModel': '请选择模型'
            },
            'en-US': {
                'model': 'Model Selection',
                'apiKey': 'API Key',
                'prompt': 'Input Prompt',
                'response': 'AI Response',
                'responseTime': 'Response Time(ms)',
                'error': 'Error Message',
                'selectModel': 'Please select model'
            },
            'ja-JP': {
                'model': 'モデル選択',
                'apiKey': 'APIキー',
                'prompt': '入力プロンプト',
                'response': 'AI応答',
                'responseTime': '応答時間(ms)',
                'error': 'エラーメッセージ',
                'selectModel': 'モデルを選択してください'
            }
        }
    },
    // 定义捷径的入参
    formItems: [
        {
            key: 'model',
            label: t('model'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                options: textModels.map(model => ({
                    value: model.value,
                    label: `${model.name} - ${model.description}`
                })),
                defaultValue: { label: 'Qwen Plus - 均衡性能，适合大多数场景', value: 'qwen-plus' }
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'apiKey',
            label: t('apiKey'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入您的DashScope API Key'
            },
            validator: {
                required: true,
                maxLength: 500
            }
        },
        {
            key: 'prompt',
            label: t('prompt'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入您的问题或要求'
            },
            validator: {
                required: true,
                maxLength: 2000
            }
        },
        {
            key: 'enableThinking',
            label: t('enableThinking'),
            component: block_basekit_server_api_1.FieldComponent.Radio,
            props: {
                options: [
                    { label: '关闭', value: false },
                    { label: '开启', value: true }
                ],
                defaultValue: { label: '关闭', value: false }
            },
            validator: {
                required: false,
            }
        }
    ],
    // 定义捷径的返回结果类型
    resultType: {
        type: block_basekit_server_api_1.FieldType.Object,
        extra: {
            icon: {
                light: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/eqgeh7upeubqnulog/chatbot.svg',
            },
            properties: [
                {
                    key: 'id',
                    isGroupByKey: true,
                    type: block_basekit_server_api_1.FieldType.Text,
                    label: 'id',
                    hidden: true,
                },
                {
                    key: 'response',
                    type: block_basekit_server_api_1.FieldType.Text,
                    label: t('response'),
                    primary: true,
                },
                {
                    key: 'responseTime',
                    type: block_basekit_server_api_1.FieldType.Number,
                    label: t('responseTime'),
                },
                {
                    key: 'model',
                    type: block_basekit_server_api_1.FieldType.Text,
                    label: t('model'),
                },
                {
                    key: 'tokens',
                    type: block_basekit_server_api_1.FieldType.Number,
                    label: t('tokens'),
                },
            ],
        },
    },
    // 执行函数
    execute: async (formItemParams, context) => {
        const { model, apiKey, prompt, enableThinking } = formItemParams;
        try {
            const startTime = Date.now();
            // 处理模型参数
            const modelValue = typeof model === 'object' ? model.value : model || 'qwen-plus';
            // 获取模型名称
            const selectedModel = textModels.find(m => m.value === modelValue);
            const modelName = selectedModel?.name || modelValue;
            // 处理深度思考模式开关
            const thinkingEnabled = enableThinking === true || enableThinking === 'true';
            // 创建文本生成服务
            const textService = new textGeneration_1.TextGenerationService(apiKey);
            // 生成文本（带 token 使用量和思考模式）
            const result = await textService.generateTextWithUsage(prompt, modelValue, thinkingEnabled);
            const responseTime = Date.now() - startTime;
            return {
                code: block_basekit_server_api_1.FieldCode.Success,
                data: {
                    id: `${Math.random()}`,
                    response: result.content,
                    responseTime: responseTime,
                    model: modelName,
                    tokens: result.totalTokens,
                }
            };
        }
        catch (e) {
            return {
                code: block_basekit_server_api_1.FieldCode.Success,
                data: {
                    id: `error-${Math.random()}`,
                    response: `错误: ${String(e)}`,
                    responseTime: 0,
                    model: 'Unknown',
                    tokens: 0,
                }
            };
        }
    },
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBNEc7QUFDNUcsOERBQWtFO0FBQ2xFLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxnQ0FBSyxDQUFDO0FBRXBCLGlCQUFpQjtBQUNqQixNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDckYsa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7QUFFL0QsYUFBYTtBQUNiLE1BQU0sVUFBVSxHQUFHLHNDQUFxQixDQUFDLGtCQUFrQixFQUFFLENBQUM7QUFFOUQsa0NBQU8sQ0FBQyxRQUFRLENBQUM7SUFDZixnQkFBZ0I7SUFDaEIsSUFBSSxFQUFFO1FBQ0osUUFBUSxFQUFFO1lBQ1IsT0FBTyxFQUFFO2dCQUNQLE9BQU8sRUFBRSxNQUFNO2dCQUNmLFFBQVEsRUFBRSxTQUFTO2dCQUNuQixRQUFRLEVBQUUsVUFBVTtnQkFDcEIsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLGNBQWMsRUFBRSxVQUFVO2dCQUMxQixRQUFRLEVBQUUsVUFBVTtnQkFDcEIsZ0JBQWdCLEVBQUUsUUFBUTtnQkFDMUIsY0FBYyxFQUFFLGVBQWU7Z0JBQy9CLE9BQU8sRUFBRSxNQUFNO2dCQUNmLGFBQWEsRUFBRSxPQUFPO2FBQ3ZCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLE9BQU8sRUFBRSxpQkFBaUI7Z0JBQzFCLFFBQVEsRUFBRSxTQUFTO2dCQUNuQixRQUFRLEVBQUUsY0FBYztnQkFDeEIsVUFBVSxFQUFFLGFBQWE7Z0JBQ3pCLGNBQWMsRUFBRSxtQkFBbUI7Z0JBQ25DLE9BQU8sRUFBRSxlQUFlO2dCQUN4QixhQUFhLEVBQUUscUJBQXFCO2FBQ3JDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQ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