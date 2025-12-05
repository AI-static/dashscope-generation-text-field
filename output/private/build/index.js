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
    options: {
        disableAutoUpdate: true, // 显示/不显示自动更新开关。注意，无法将其设置为显示但默认关闭的状态
    },
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
                'selectModel': '请选择模型',
                'imageUrl': '图片附件',
                'imageUrlPlaceholder': '请选择包含图片的附件字段'
            },
            'en-US': {
                'model': 'Model Selection',
                'apiKey': 'API Key',
                'prompt': 'Input Prompt',
                'response': 'AI Response',
                'responseTime': 'Response Time(ms)',
                'error': 'Error Message',
                'selectModel': 'Please select model',
                'imageUrl': 'Image Attachment',
                'imageUrlPlaceholder': 'Please select attachment field containing images'
            },
            'ja-JP': {
                'model': 'モデル選択',
                'apiKey': 'APIキー',
                'prompt': '入力プロンプト',
                'response': 'AI応答',
                'responseTime': '応答時間(ms)',
                'error': 'エラーメッセージ',
                'selectModel': 'モデルを選択してください',
                'imageUrl': '画像添付',
                'imageUrlPlaceholder': '画像を含む添付フィールドを選択してください'
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
            key: 'imageUrl',
            label: t('imageUrl'),
            component: block_basekit_server_api_1.FieldComponent.FieldSelect,
            props: {
                placeholder: t('imageUrlPlaceholder'),
                supportType: [block_basekit_server_api_1.FieldType.Attachment] // 只允许选择附件类型的字段
            },
            validator: {
                required: false
            }
        },
        {
            key: 'enableThinking',
            label: t('enableThinking'),
            component: block_basekit_server_api_1.FieldComponent.Radio,
            defaultValue: { label: '关闭', value: false },
            props: {
                options: [
                    { label: '关闭', value: false },
                    { label: '开启', value: true }
                ]
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
        const { model, apiKey, prompt, imageUrl, enableThinking } = formItemParams;
        try {
            const startTime = Date.now();
            // 处理模型参数
            const modelValue = typeof model === 'object' ? model.value : model || 'qwen-plus';
            // 获取模型信息
            const selectedModel = textModels.find(m => m.value === modelValue);
            const modelName = selectedModel?.name || modelValue;
            const supportsThinking = selectedModel?.supportsThinking || false;
            const supportsVision = selectedModel?.supportsVision || false;
            // 处理深度思考模式开关（只有模型支持才启用）
            const thinkingEnabled = supportsThinking && (enableThinking === true || enableThinking === 'true');
            // 处理图片附件（只有模型支持视觉才添加图片）
            let fullPrompt = prompt;
            // FieldSelect返回的是附件数据格式
            let imageUrlStr = '';
            if (imageUrl && Array.isArray(imageUrl) && imageUrl.length > 0) {
                // 处理附件数组格式：[{ name: string; size: number; type: string; tmp_url: string }]
                const imageAttachments = imageUrl.filter(att => att.type && att.type.startsWith('image/') && att.tmp_url);
                if (imageAttachments.length > 0) {
                    imageUrlStr = imageAttachments[0].tmp_url;
                }
            }
            else if (imageUrl && typeof imageUrl === 'object' && imageUrl.tmp_url) {
                // 处理单个附件对象
                if (imageUrl.type && imageUrl.type.startsWith('image/')) {
                    imageUrlStr = imageUrl.tmp_url;
                }
            }
            if (imageUrlStr && supportsVision) {
                fullPrompt = `${prompt}\n\n图片附件：${imageUrlStr}`;
            }
            else if (imageUrlStr && !supportsVision) {
                // 如果模型不支持视觉，在prompt中提示用户
                fullPrompt = `${prompt}\n\n注意：当前模型不支持图片理解，请使用支持视觉的模型（如Qwen3-VL系列）来处理图片。`;
            }
            // 创建文本生成服务
            const textService = new textGeneration_1.TextGenerationService(apiKey);
            // 生成文本（带 token 使用量和思考模式）
            const result = await textService.generateTextWithUsage(fullPrompt, modelValue, thinkingEnabled, supportsVision);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBNEc7QUFDNUcsOERBQWtFO0FBQ2xFLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxnQ0FBSyxDQUFDO0FBRXBCLGlCQUFpQjtBQUNqQixNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDckYsa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7QUFFL0QsYUFBYTtBQUNiLE1BQU0sVUFBVSxHQUFHLHNDQUFxQixDQUFDLGtCQUFrQixFQUFFLENBQUM7QUFFOUQsa0NBQU8sQ0FBQyxRQUFRLENBQUM7SUFDZixPQUFPLEVBQUU7UUFDUCxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsb0NBQW9DO0tBQzlEO0lBQ0QsZ0JBQWdCO0lBQ2hCLElBQUksRUFBRTtRQUNKLFFBQVEsRUFBRTtZQUNSLE9BQU8sRUFBRTtnQkFDUCxPQUFPLEVBQUUsTUFBTTtnQkFDZixRQUFRLEVBQUUsU0FBUztnQkFDbkIsUUFBUSxFQUFFLFVBQVU7Z0JBQ3BCLFVBQVUsRUFBRSxNQUFNO2dCQUNsQixjQUFjLEVBQUUsVUFBVTtnQkFDMUIsUUFBUSxFQUFFLFVBQVU7Z0JBQ3BCLGdCQUFnQixFQUFFLFFBQVE7Z0JBQzFCLGNBQWMsRUFBRSxlQUFlO2dCQUMvQixPQUFPLEVBQUUsTUFBTTtnQkFDZixhQUFhLEVBQUUsT0FBTztnQkFDdEIsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLHFCQUFxQixFQUFFLGNBQWM7YUFDdEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsT0FBTyxFQUFFLGlCQUFpQjtnQkFDMUIsUUFBUSxFQUFFLFNBQVM7Z0JBQ25CLFFBQVEsRUFBRSxjQUFjO2dCQUN4QixVQUFVLEVBQUUs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