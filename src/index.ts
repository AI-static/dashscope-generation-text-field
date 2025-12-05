import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
import { TextGenerationService } from './services/textGeneration';
const { t } = field;

// 添加飞书和阿里云域名到白名单
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com'];
basekit.addDomainList([...feishuDm, 'dashscope.aliyuncs.com']);

// 从服务层获取模型配置
const textModels = TextGenerationService.getSupportedModels();

basekit.addField({
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
      key: 'imageUrl',
      label: t('imageUrl'),
      component: FieldComponent.FieldSelect,
      props: {
        placeholder: t('imageUrlPlaceholder'),
        supportType: [FieldType.Attachment]  // 只允许选择附件类型的字段
      },
      validator: {
        required: false
      }
    },
    {
      key: 'enableThinking',
      label: t('enableThinking'),
      component: FieldComponent.Radio,
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
        const imageAttachments = imageUrl.filter(att => 
          att.type && att.type.startsWith('image/') && att.tmp_url
        );
        if (imageAttachments.length > 0) {
          imageUrlStr = imageAttachments[0].tmp_url;
        }
      } else if (imageUrl && typeof imageUrl === 'object' && imageUrl.tmp_url) {
        // 处理单个附件对象
        if (imageUrl.type && imageUrl.type.startsWith('image/')) {
          imageUrlStr = imageUrl.tmp_url;
        }
      }
      
      if (imageUrlStr && supportsVision) {
        fullPrompt = `${prompt}\n\n图片附件：${imageUrlStr}`;
      } else if (imageUrlStr && !supportsVision) {
        // 如果模型不支持视觉，在prompt中提示用户
        fullPrompt = `${prompt}\n\n注意：当前模型不支持图片理解，请使用支持视觉的模型（如Qwen3-VL系列）来处理图片。`;
      }
      
      // 创建文本生成服务
      const textService = new TextGenerationService(apiKey);
      
      // 生成文本（带 token 使用量和思考模式）
      const result = await textService.generateTextWithUsage(fullPrompt, modelValue, thinkingEnabled, supportsVision);
      
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