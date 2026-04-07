import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AlohubApi implements ICredentialType {
	name = 'alohubApi';
	icon = 'file:alohub.svg' as const;
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
			description: 'Get your API key at alohub.vn/settings/api-keys',
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
			description: 'Sandbox returns mock responses without sending real messages',
		},
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			description: 'Only required when using reseller / sub-account model',
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

	// TODO: change to https://api.alohub.vn/v1/account/me when API is ready
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://httpbin.org',
			url: '/status/200',
			method: 'GET',
		},
	};
}
