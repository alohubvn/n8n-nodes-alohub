import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

// ── Mock helper ─────────────────────────────────────────────────────────────
function mockMessageId() {
	return 'alo_msg_' + Math.random().toString(36).slice(2, 11);
}

function buildBaseUrl(environment: string): string {
	return environment === 'sandbox'
		? 'https://sandbox.alohub.vn'
		: 'https://api.alohub.vn';
}

function mockSmsResponse(to: string, from: string): IDataObject {
	return {
		messageId: mockMessageId(),
		status: 'queued',
		channel: 'sms',
		to,
		from: from || 'ALOHUB',
		cost: '0.002',
		currency: 'USD',
		sentAt: new Date().toISOString(),
		accountId: 'acct_mock',
		error: null,
	};
}

function mockZnsResponse(to: string, templateId: string): IDataObject {
	return {
		messageId: mockMessageId(),
		status: 'queued',
		channel: 'zns',
		to,
		templateId,
		cost: '0.005',
		currency: 'USD',
		sentAt: new Date().toISOString(),
		accountId: 'acct_mock',
		error: null,
	};
}

function mockVoiceResponse(to: string): IDataObject {
	return {
		callId: 'alo_call_' + Math.random().toString(36).slice(2, 11),
		status: 'initiated',
		channel: 'voice',
		to,
		from: '02812345678',
		duration: null,
		cost: '0.01',
		currency: 'USD',
		initiatedAt: new Date().toISOString(),
		accountId: 'acct_mock',
		error: null,
	};
}

// ── Node definition ──────────────────────────────────────────────────────────
export class Alohub implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Alohub',
		name: 'alohub',
		icon: 'file:alohub.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Gửi SMS, Zalo ZNS và gọi thoại qua Alohub CPaaS',
		defaults: { name: 'Alohub' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'alohubApi',
				required: true,
			},
		],
		properties: [
			// ── Resource ────────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'SMS', value: 'sms' },
					{ name: 'Zalo ZNS', value: 'zns' },
					{ name: 'Voice', value: 'voice' },
				],
				default: 'sms',
			},

			// ── SMS operations ───────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['sms'] } },
				options: [{ name: 'Send', value: 'send', action: 'Send an SMS' }],
				default: 'send',
			},

			// ── ZNS operations ───────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['zns'] } },
				options: [{ name: 'Send', value: 'send', action: 'Send a Zalo ZNS' }],
				default: 'send',
			},

			// ── Voice operations ─────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['voice'] } },
				options: [{ name: 'Make Call', value: 'makeCall', action: 'Make a voice call' }],
				default: 'makeCall',
			},

			// ════════════════════════════════════════════════════════════════
			// SMS — Send fields
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'To (Phone Number)',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+84912345678',
				description: 'Số điện thoại nhận. Hỗ trợ expression n8n: {{ $json.phone }}',
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 3 },
				placeholder: 'Chào {{ $json.name }}, đơn hàng của bạn đã được xác nhận.',
				description: 'Nội dung tin nhắn. Tối đa 160 ký tự/SMS. Hỗ trợ expression.',
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},
			{
				displayName: 'Sender ID / Brandname',
				name: 'senderId',
				type: 'string',
				default: '',
				placeholder: 'ALOHUB',
				description: 'Brandname đã đăng ký. Để trống dùng mặc định.',
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// ZNS — Send fields
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'To (Phone Number)',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+84912345678',
				description: 'Số điện thoại nhận (phải là tài khoản Zalo)',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '123456',
				description: 'ID template ZNS đã được Zalo duyệt',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
			{
				displayName: 'Template Parameters',
				name: 'templateParams',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				description: 'Các biến trong template ZNS (key-value)',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
				options: [
					{
						name: 'params',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								placeholder: 'order_id',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: '{{ $json.orderId }}',
							},
						],
					},
				],
			},
			{
				displayName: 'OA ID',
				name: 'oaId',
				type: 'string',
				default: '',
				description: 'Zalo Official Account ID. Để trống dùng OA mặc định.',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// Voice — Make Call fields
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'To (Phone Number)',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+84912345678',
				description: 'Số điện thoại cần gọi',
				displayOptions: { show: { resource: ['voice'], operation: ['makeCall'] } },
			},
			{
				displayName: 'TTS Content',
				name: 'ttsContent',
				type: 'string',
				default: '',
				typeOptions: { rows: 3 },
				placeholder: 'Xin chào {{ $json.name }}, đây là nhắc nhở lịch hẹn của bạn.',
				description: 'Nội dung đọc thoại (Text-to-Speech). Hỗ trợ expression.',
				displayOptions: { show: { resource: ['voice'], operation: ['makeCall'] } },
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				options: [
					{ name: 'Vi-Female (mặc định)', value: 'vi-female' },
					{ name: 'Vi-Male', value: 'vi-male' },
				],
				default: 'vi-female',
				displayOptions: { show: { resource: ['voice'], operation: ['makeCall'] } },
			},
			{
				displayName: 'Caller Number',
				name: 'callerNumber',
				type: 'string',
				default: '',
				description: 'Số gọi ra. Để trống dùng số mặc định của account.',
				displayOptions: { show: { resource: ['voice'], operation: ['makeCall'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// Options (shared)
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Webhook Callback URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description: 'Alohub gọi URL này khi tin nhắn delivered / failed',
					},
					{
						displayName: 'Account ID Override',
						name: 'accountId',
						type: 'string',
						default: '',
						description: 'Override account khi dùng mô hình đại lý',
					},
					{
						displayName: 'Dry Run (No Send)',
						name: 'dryRun',
						type: 'boolean',
						default: false,
						description: 'Whether to test flow mà không gửi thật',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('alohubApi');
		const environment = credentials.environment as string;
		const isSandbox = environment === 'sandbox';
		const baseUrl = buildBaseUrl(environment);

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;
			const options = this.getNodeParameter('options', i, {}) as {
				webhookUrl?: string;
				accountId?: string;
				dryRun?: boolean;
			};

			let responseData: IDataObject;

			try {
				// ── SMS: Send ────────────────────────────────────────────────
				if (resource === 'sms' && operation === 'send') {
					const to = this.getNodeParameter('to', i) as string;
					const message = this.getNodeParameter('message', i) as string;
					const senderId = this.getNodeParameter('senderId', i, '') as string;

					if (isSandbox || options.dryRun) {
						responseData = mockSmsResponse(to, senderId);
						if (options.dryRun) responseData.dryRun = true;
					} else {
						// TODO: thay bằng real API call khi BE sẵn sàng
						const body: IDataObject = { to, message };
						if (senderId) body.senderId = senderId;
						if (options.webhookUrl) body.webhookUrl = options.webhookUrl;
						if (options.accountId || credentials.accountId)
							body.accountId = options.accountId || credentials.accountId;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'alohubApi',
							{
								method: 'POST',
								url: `${baseUrl}/v1/messages/sms`,
								headers: { 'Content-Type': 'application/json' },
								body,
								json: true,
							},
						);
						responseData = response as IDataObject;
					}
				}

				// ── ZNS: Send ────────────────────────────────────────────────
				else if (resource === 'zns' && operation === 'send') {
					const to = this.getNodeParameter('to', i) as string;
					const templateId = this.getNodeParameter('templateId', i) as string;
					const oaId = this.getNodeParameter('oaId', i, '') as string;
					const rawParams = this.getNodeParameter('templateParams', i, {}) as {
						params?: Array<{ key: string; value: string }>;
					};

					const templateData: Record<string, string> = {};
					if (rawParams.params) {
						for (const p of rawParams.params) {
							if (p.key) templateData[p.key] = p.value;
						}
					}

					if (isSandbox || options.dryRun) {
						responseData = mockZnsResponse(to, templateId);
						if (options.dryRun) responseData.dryRun = true;
					} else {
						// TODO: thay bằng real API call khi BE sẵn sàng
						const body: IDataObject = { to, templateId, templateData };
						if (oaId) body.oaId = oaId;
						if (options.webhookUrl) body.webhookUrl = options.webhookUrl;
						if (options.accountId || credentials.accountId)
							body.accountId = options.accountId || credentials.accountId;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'alohubApi',
							{
								method: 'POST',
								url: `${baseUrl}/v1/messages/zns`,
								headers: { 'Content-Type': 'application/json' },
								body,
								json: true,
							},
						);
						responseData = response as IDataObject;
					}
				}

				// ── Voice: Make Call ─────────────────────────────────────────
				else if (resource === 'voice' && operation === 'makeCall') {
					const to = this.getNodeParameter('to', i) as string;
					const ttsContent = this.getNodeParameter('ttsContent', i, '') as string;
					const voice = this.getNodeParameter('voice', i) as string;
					const callerNumber = this.getNodeParameter('callerNumber', i, '') as string;

					if (isSandbox || options.dryRun) {
						responseData = mockVoiceResponse(to);
						if (options.dryRun) responseData.dryRun = true;
					} else {
						// TODO: thay bằng real API call khi BE sẵn sàng
						const body: IDataObject = { to, voice };
						if (ttsContent) body.ttsContent = ttsContent;
						if (callerNumber) body.callerNumber = callerNumber;
						if (options.webhookUrl) body.webhookUrl = options.webhookUrl;
						if (options.accountId || credentials.accountId)
							body.accountId = options.accountId || credentials.accountId;

						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'alohubApi',
							{
								method: 'POST',
								url: `${baseUrl}/v1/voice/call`,
								headers: { 'Content-Type': 'application/json' },
								body,
								json: true,
							},
						);
						responseData = response as IDataObject;
					}
				}

				else {
					throw new NodeOperationError(
						this.getNode(),
						`Resource "${resource}" / operation "${operation}" chưa được hỗ trợ`,
					);
				}

				returnData.push({
					json: responseData,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
