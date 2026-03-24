#include <iostream>
#include <vector>
#include <algorithm>

#include <vector>
#include <algorithm>

class Solution {
public:
    void reverseArray(std::vector<int>& arr) {
        std::reverse(arr.begin(), arr.end());
    }
};


int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);
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