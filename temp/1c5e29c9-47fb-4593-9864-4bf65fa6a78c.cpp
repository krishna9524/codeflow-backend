#include <bits/stdc++.h>
using namespace std;
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    void reverseArray(vector<int>& arr) {
        int n = arr.size();
        for (int i = 0; i < n / 2; i++) {
            swap(arr[i], arr[n - i - 1]);
        }
    }
};


int main() {
    int n;
    std::cin >> n;
    std::vector<int> arr(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> arr[i];
    }

    Solution sol;
    sol.reverseArray(arr);

    for (int i = 0; i < n; ++i) {
        std::cout << arr[i] << (i == n - 1 ? "" : " ");
    }
    std::cout << std::endl;

    return 0;
}

// We expect the user's code to provide a function with this signature:
// void user_solve(std::vector<int>& arr);
// If user's driver uses a different name, you must ensure combineCode places the correct function.

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;
    vector<int> arr(n);
    for (int i = 0; i < n; ++i) cin >> arr[i];

    // iterations and warmup
    int iterations = 2000;
    // warmup
    {
        vector<int> tmp = arr;
        user_solve(tmp);
    }

    // measurement
    volatile long long checksum = 0;
    auto start = chrono::high_resolution_clock::now();
    for (int it = 0; it < iterations; ++it) {
        vector<int> tmp = arr; // copy so function works in-place
        user_solve(tmp);
        // create small checksum so work cannot be optimized away
        long long s = 0;
        for (int x : tmp) s = s * 31 + x;
        checksum ^= s;
    }
    auto end = chrono::high_resolution_clock::now();
    double avgMs = chrono::duration<double, milli>(end - start).count() / (double)iterations;

    // Output JSON to parse easily
    cout.setf(std::ios::fixed); cout<<setprecision(6);
    cout << "{"time_ms": " << avgMs << ", "checksum": " << checksum << "}\n";
    return 0;
}