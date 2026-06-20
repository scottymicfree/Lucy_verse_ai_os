import time
import asyncio
from typing import Callable, Any, Awaitable

class CircuitOpenException(Exception):
	pass

class CircuitBreaker:
	"""An async-compatible in-process circuit breaker with a bulkhead semaphore."""

	def __init__(self, name: str, failure_threshold: int = 5, recovery_timeout: int = 30,
				 volume_threshold: int = 5, timeout: int = 3, capacity: int = 10):
		self.name = name
		self.failure_threshold = failure_threshold
		self.recovery_timeout = recovery_timeout
		self.volume_threshold = volume_threshold
		self.timeout = timeout
		self.capacity = capacity

		self._lock = None
		self._semaphore = None

		self._state = 'CLOSED'
		self._failure_count = 0
		self._success_count = 0
		self._last_failure_time = 0.0

	def _ensure_async_primitives(self):
		if self._lock is None:
			self._lock = asyncio.Lock()
		if self._semaphore is None:
			self._semaphore = asyncio.BoundedSemaphore(self.capacity)

	@property
	def state(self):
		if self._state == 'OPEN' and (time.time() - self._last_failure_time) >= self.recovery_timeout:
			return 'HALF_OPEN'
		return self._state

	async def _record_success(self):
		self._ensure_async_primitives()
		async with self._lock:
			self._success_count += 1
			self._failure_count = max(0, self._failure_count - 1)
			if self._failure_count == 0:
				self._state = 'CLOSED'

	async def _record_failure(self):
		self._ensure_async_primitives()
		async with self._lock:
			self._failure_count += 1
			self._last_failure_time = time.time()
			if self._failure_count >= self.failure_threshold and self._state != 'OPEN':
				self._state = 'OPEN'

	async def call(self, func: Callable[[], Awaitable[Any]], fallback: Callable[[Exception], Awaitable[Any]] | None = None) -> Any:
		self._ensure_async_primitives()
		
		if self._semaphore.locked():
			ex = CircuitOpenException('bulkhead_capacity_exhausted')
			if fallback:
				return await fallback(ex)
			raise ex

		await self._semaphore.acquire()
		try:
			cur_state = self.state
			if cur_state == 'OPEN':
				ex = CircuitOpenException('circuit_open')
				if fallback:
					return await fallback(ex)
				raise ex

			try:
				res = await func()
			except Exception as e:
				await self._record_failure()
				if fallback:
					return await fallback(e)
				raise
			else:
				await self._record_success()
				return res
		finally:
			try:
				self._semaphore.release()
			except Exception:
				pass


