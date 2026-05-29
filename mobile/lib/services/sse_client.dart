import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'api_client.dart';

/// Represents a parsed SSE event from the chat API
class SseEvent {
  final String? text;
  final String? title;
  final String? error;
  final bool? done;
  final bool? searching;
  final String? searchQuery;
  final bool? finalizeMessage;
  final bool? newMessage;
  final Map<String, dynamic>? characterInfo;

  const SseEvent({
    this.text,
    this.title,
    this.error,
    this.done,
    this.searching,
    this.searchQuery,
    this.finalizeMessage,
    this.newMessage,
    this.characterInfo,
  });

  factory SseEvent.fromJson(Map<String, dynamic> json) {
    return SseEvent(
      text: json['text'] as String?,
      title: json['title'] as String?,
      error: json['error'] as String?,
      done: json['done'] as bool?,
      searching: json['searching'] as bool?,
      searchQuery: json['query'] as String?,
      finalizeMessage: json['finalizeMessage'] as bool?,
      newMessage: json['newMessage'] as bool?,
      characterInfo: json['characterInfo'] as Map<String, dynamic>?,
    );
  }
}

/// SSE client that streams chat responses from the API.
/// Handles buffering, partial chunks, and reconnection.
class SseClient {
  final ApiClient _api = ApiClient.instance;

  /// Sends a message and returns a stream of SSE events.
  ///
  /// The caller should listen to the stream and handle each event type:
  /// - text: Append to the current message
  /// - title: Update chat title
  /// - done: Stream is complete
  /// - error: Display error to user
  /// - searching: Show/hide search indicator
  /// - characterInfo: Style the response bubble
  Stream<SseEvent> sendMessage({
    required String message,
    required String chatId,
    String? fileUrl,
    String? fileType,
    String? fileName,
    String? characterId,
    bool regenerate = false,
    int? regenerateFromIndex,
    int? editFromMessageIndex,
  }) async* {
    final body = <String, dynamic>{
      'message': message,
      'chatId': chatId,
    };

    if (fileUrl != null) body['fileUrl'] = fileUrl;
    if (fileType != null) body['fileType'] = fileType;
    if (fileName != null) body['fileName'] = fileName;
    if (characterId != null) body['characterId'] = characterId;
    if (regenerate) body['regenerate'] = true;
    if (regenerateFromIndex != null) {
      body['regenerateFromIndex'] = regenerateFromIndex;
    }
    if (editFromMessageIndex != null) {
      body['editFromMessageIndex'] = editFromMessageIndex;
    }

    Response<ResponseBody> response;
    try {
      response = await _api.stream('/api/chat', data: body);
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 429) {
        yield const SseEvent(error: 'Daily message limit reached');
        return;
      }
      yield SseEvent(error: 'Failed to connect: $e');
      return;
    }

    final stream = response.data?.stream;
    if (stream == null) {
      yield const SseEvent(error: 'No response stream');
      return;
    }

    // Buffer for handling partial chunks across TCP packets
    String buffer = '';

    await for (final chunk in stream) {
      buffer += utf8.decode(chunk, allowMalformed: true);

      // Split on double newlines (SSE event delimiter)
      while (buffer.contains('\n\n')) {
        final eventEnd = buffer.indexOf('\n\n');
        final eventStr = buffer.substring(0, eventEnd);
        buffer = buffer.substring(eventEnd + 2);

        // Parse each line of the event
        for (final line in eventStr.split('\n')) {
          if (line.startsWith('data: ')) {
            final jsonStr = line.substring(6).trim();
            if (jsonStr.isEmpty || jsonStr == '[DONE]') continue;

            try {
              final json = jsonDecode(jsonStr) as Map<String, dynamic>;
              yield SseEvent.fromJson(json);
            } catch (_) {
              // Skip malformed JSON lines
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().isNotEmpty) {
      for (final line in buffer.split('\n')) {
        if (line.startsWith('data: ')) {
          final jsonStr = line.substring(6).trim();
          if (jsonStr.isEmpty || jsonStr == '[DONE]') continue;
          try {
            final json = jsonDecode(jsonStr) as Map<String, dynamic>;
            yield SseEvent.fromJson(json);
          } catch (_) {}
        }
      }
    }
  }
}
