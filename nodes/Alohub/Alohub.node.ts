import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

const BASE_URL = 'https://app.alohub.vn:9909';

function generateTransactionId(): string {
	const ts = Date.now().toString(36);
	const rand = Math.random().toString(36).slice(2, 8);
	return `ah_n8n_${ts}_${rand}`;
}

const ERROR_CODES: Record<string, string> = {
	'0': 'System error',
	'1': 'Invalid API key',
	'2': 'Invalid phone number',
	'3': 'Insufficient balance',
	'4': 'Rate limit exceeded',
	'5': 'Invalid campaign ID',
	'6': 'Campaign not found',
	'7': 'Template not approved',
	'8': 'IP phone not found',
	'9': 'Phone number blacklisted',
	'10': 'Service unavailable',
};

function parseApiResponse(
	body: IDataObject,
	httpStatus: number,
	transactionId: string,
	resource: string,
	operation: string,
): IDataObject {
	return {
		success: String(body.success) === '1',
		httpStatus,
		transactionId,
		resource,
		operation,
		timestamp: new Date().toISOString(),
		...body,
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
		description: 'Send Zalo ZNS notifications and make voice calls via Alohub CPaaS',
		defaults: { name: 'Alohub' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'alohubApi', // eslint-disable-line @n8n/community-nodes/no-credential-reuse
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
					{ name: 'Voice', value: 'voice' },
					{ name: 'Zalo ZNS', value: 'zns' },
				],
				default: 'voice',
			},

			// ── Voice operations ─────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['voice'] } },
				options: [{ name: 'Click to Call', value: 'makeToCall', action: 'Make to call' }],
				default: 'makeToCall',
			},

			// ── ZNS operations ───────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['zns'] } },
				options: [{ name: 'Send', value: 'send', action: 'Send ZNS' }],
				default: 'send',
			},

			// ════════════════════════════════════════════════════════════════
			// Voice — Click to Call
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number to call',
				displayOptions: { show: { resource: ['voice'], operation: ['makeToCall'] } },
			},
			{
				displayName: 'IP Phone',
				name: 'ipPhone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '6688',
				description: 'IP phone extension number (e.g. 6688)',
				displayOptions: { show: { resource: ['voice'], operation: ['makeToCall'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// ZNS — Send
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number (must have a Zalo account)',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'number',
				required: true,
				default: 0,
				placeholder: '1',
				description: 'Campaign ID for the ZNS template',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
				options: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'Recipient name',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						placeholder: 'john@example.com',
						description: 'Recipient email',
					},
					{
						displayName: 'Address',
						name: 'address',
						type: 'string',
						default: '',
						description: 'Recipient address',
					},
					{
						displayName: 'Custom Field 1',
						name: 'pField1',
						type: 'string',
						default: '',
						description: 'Personalization field 1',
					},
					{
						displayName: 'Custom Field 2',
						name: 'pField2',
						type: 'string',
						default: '',
						description: 'Personalization field 2',
					},
					{
						displayName: 'Custom Field 3',
						name: 'pField3',
						type: 'string',
						default: '',
						description: 'Personalization field 3',
					},
					{
						displayName: 'Custom Field 4',
						name: 'pField4',
						type: 'string',
						default: '',
						description: 'Personalization field 4',
					},
					{
						displayName: 'Custom Field 5',
						name: 'pField5',
						type: 'string',
						default: '',
						description: 'Personalization field 5',
					},
					{
						displayName: 'Custom Field 6',
						name: 'pField6',
						type: 'string',
						default: '',
						description: 'Personalization field 6',
					},
				],
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: IDataObject;

			try {
				let transactionId = '';
				let httpStatus = 0;

				// ── Voice: Click to Call ─────────────────────────────────────
				if (resource === 'voice' && operation === 'makeToCall') {
					const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
					const ipPhone = this.getNodeParameter('ipPhone', i) as string;
					transactionId = generateTransactionId();

					const body: IDataObject = { phoneNumber, ipPhone, transactionId };

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/voice/click-to-call`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							returnFullResponse: true,
						},
					);
					const fullRes = response as IDataObject;
					httpStatus = (fullRes.statusCode as number) || 0;
					responseData = (fullRes.body as IDataObject) || fullRes;
				}

				// ── ZNS: Send ────────────────────────────────────────────────
				else if (resource === 'zns' && operation === 'send') {
					const phone = this.getNodeParameter('phone', i) as string;
					const campaignId = this.getNodeParameter('campaignId', i) as number;
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					transactionId = generateTransactionId();

					const body: IDataObject = { phone, campaignId, transactionId };

					for (const [key, value] of Object.entries(additionalFields)) {
						if (value !== '' && value !== undefined) {
							body[key] = value;
						}
					}

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/zns/send`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							returnFullResponse: true,
						},
					);
					const fullRes = response as IDataObject;
					httpStatus = (fullRes.statusCode as number) || 0;
					responseData = (fullRes.body as IDataObject) || fullRes;
				}

				else {
					throw new NodeOperationError(
						this.getNode(),
						`Resource "${resource}" / operation "${operation}" is not supported`,
					);
				}

				// ── Handle API response ──────────────────────────────────────
				const enriched = parseApiResponse(responseData, httpStatus, transactionId, resource, operation);

				if (String(responseData.success) !== '1') {
					const code = String(responseData.error_code ?? '');
					const apiMsg = (responseData.error_message as string) || 'Unknown error';
					const hint = ERROR_CODES[code] || '';
					const message = hint ? `${apiMsg} (${hint})` : apiMsg;

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								...enriched,
								success: false,
								errorCode: code,
								errorMessage: message,
							},
							pairedItem: { item: i },
						});
						continue;
					}

					throw new NodeOperationError(
						this.getNode(),
						`Alohub API error [${code}]: ${message} (Transaction: ${transactionId})`,
					);
				}

				returnData.push({
					json: enriched,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: (error as Error).message,
							timestamp: new Date().toISOString(),
						},
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
