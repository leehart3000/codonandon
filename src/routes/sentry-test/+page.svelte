<script lang="ts">
	function throwTestError() {
		throw new Error('Sentry test error from Tetraminos');
	}
</script>

<button type="button" onclick={throwTestError}>Throw test error</button>
