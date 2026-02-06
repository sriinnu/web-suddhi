// WebSuddhi - iOS Main App
import SwiftUI

@main
struct WebSuddhiApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

struct ContentView: View {
  var body: some View {
    VStack(spacing: 20) {
      Image(systemName: "shield.checkered")
        .font(.system(size: 80))
        .foregroundColor(.cyan)

      Text("WebSuddhi")
        .font(.largeTitle)
        .fontWeight(.bold)

      Text("Safari Extension for iOS")
        .font(.subheadline)
        .foregroundColor(.secondary)

      Divider()
        .padding(.vertical)

      VStack(alignment: .leading, spacing: 15) {
        FeatureRow(icon: "xmark.shield", text: "Block Ads")
        FeatureRow(icon: "lock.open", text: "Remove Paywalls")
        FeatureRow(icon: "eye.slash", text: "Privacy Protection")
        FeatureRow(icon: "hand.raised", text: "No Tracking")
      }

      Divider()
        .padding(.vertical)

      VStack(spacing: 10) {
        Text("Setup Instructions")
          .font(.headline)

        Text("1. Go to Settings > Safari > Extensions")
        Text("2. Enable WebSuddhi")
        Text("3. Grant All Websites permission")
      }
      .font(.caption)
      .foregroundColor(.secondary)

      Spacer()
    }
    .padding()
  }
}

struct FeatureRow: View {
  let icon: String
  let text: String

  var body: some View {
    HStack {
      Image(systemName: icon)
        .foregroundColor(.cyan)
        .frame(width: 30)
      Text(text)
    }
  }
}

#Preview {
  ContentView()
}
