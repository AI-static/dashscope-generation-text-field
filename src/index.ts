import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
import { TextGenerationService } from './services/textGeneration';
const { t } = field;

// 添加飞书和阿里云域名到白名单
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
basekit.addDomainList([...feishuDm, 'dashscope.aliyuncs.com']);

// 从服务层获取模型配置
const textModels = TextGenerationService.getSupportedModels();

basekit.addField({
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
      component: FieldComponent.SingleSelect,
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
      component: FieldComponent.Input,
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
      component: FieldComponent.Input,
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
      component: FieldComponent.Radio,
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
    type: FieldType.Object,
    extra: {
      icon: {
        light: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/eqgeh7upeubqnulog/chatbot.svg',
      },
      properties: [
        {
          key: 'id',
          isGroupByKey: true,
          type: FieldType.Text,
          label: 'id',
          hidden: true,
        },
        {
          key: 'response',
          type: FieldType.Text,
          label: t('response'),
          primary: true,
        },
        {
          key: 'responseTime',
          type: FieldType.Number,
          label: t('responseTime'),
        },
        {
          key: 'model',
          type: FieldType.Text,
          label: t('model'),
        },
        {
          key: 'tokens',
          type: FieldType.Number,
          label: t('tokens'),
        },
      ],
    },
  },
  // 执行函数
  execute: async (formItemParams: any, context) => {
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
      const textService = new TextGenerationService(apiKey);
      
      // 生成文本（带 token 使用量和思考模式）
      const result = await textService.generateTextWithUsage(prompt, modelValue, thinkingEnabled);
      
      const responseTime = Date.now() - startTime;

      return {
        code: FieldCode.Success,
        data: {
          id: `${Math.random()}`,
          response: result.content,
          responseTime: responseTime,
          model: modelName,
          tokens: result.totalTokens,
        }
      }
      
    } catch (e) {
      return {
        code: FieldCode.Success,
        data: {
          id: `error-${Math.random()}`,
          response: `错误: ${String(e)}`,
          responseTime: 0,
          model: 'Unknown',
          tokens: 0,
        }
      }
    }
  },
});

export default basekit;