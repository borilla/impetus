import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

const babelOptions = {
	exclude: 'node_modules/**',
	plugins: [ 'external-helpers' ],
	presets: [
		[ 'es2015', { 'modules': false } ],
	],
	babelrc: false,
};

const uglifyOptions = {
	compress: {
		passes: 2,
	},
	mangle: {
		toplevel: true,
		properties: {
			regex: /^_/,
		},
	},
	toplevel: true,
};

function makeRollupConfig(globalObjectName, inputFile, outputFile) {
	const config = {
		name: globalObjectName,
		input: inputFile,
		output: {
			file: outputFile,
			format: 'umd',
		},
		sourcemap: true,
		plugins: [
			resolve(),
			commonjs(),
			babel(babelOptions),
		],
	};

	if (outputFile.includes('.min.')) {
		config.plugins.push(uglify(uglifyOptions));
	}

	return config;
}

export default [
	makeRollupConfig('Impetus', 'src/impetus.js', 'dist/impetus.js'),
	makeRollupConfig('Impetus', 'src/impetus.js', 'dist/impetus.min.js'),
];
