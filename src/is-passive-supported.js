export default function isPassiveSupported() {
	let _isPassiveSupported = false;

	try {
		const name = 'test';
		const noop = () => {};
		const options = Object.defineProperty({}, 'passive', {
			get: () => {
				_isPassiveSupported = true;
			}
		});

		addEventListener(name, noop, options);
		removeEventListener(name, noop);
	} catch (err) {}

	return _isPassiveSupported;
}
