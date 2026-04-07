import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AlohubApi implements ICredentialType {
	name = 'alohubApi';
	displayName = 'Alohub API';
	documentationUrl = 'https://alohub.vn/docs/api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Lấy tại alohub.vn/settings/api-keys',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Production', value: 'production' },
				{ name: 'Sandbox (Mock)', value: 'sandbox' },
			],
			default: 'sandbox',
			description: 'Sandbox trả mock response — không gửi thật',
		},
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			description: 'Chỉ cần khi dùng mô hình đại lý / sub-account',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// TODO: đổi lại thành https://api.alohub.vn/v1/account/me khi BE sẵn sàng
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://httpbin.org',
			url: '/status/200',
			method: 'GET',
		},
	};
}
