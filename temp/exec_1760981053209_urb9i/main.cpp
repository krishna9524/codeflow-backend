#include <vector>
using namespace std;
class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        return {};
    }
};#include <iostream>
#include <vector>
#include <sstream>
#include <algorithm>
#include <string>
int main() {
    std::string line; std::getline(std::cin, line);
    line.erase(std::remove(line.begin(), line.end(), '['), line.end());
    line.erase(std::remove(line.begin(), line.end(), ']'), line.end());
    std::stringstream ss(line); std::vector<int> nums; std::string token;
    while (std::getline(ss, token, ',')) { if (!token.empty()) nums.push_back(std::stoi(token)); }
    Solution sol; std::vector<std::vector<int>> result = sol.threeSum(nums);
    for (auto& triplet : result) std::sort(triplet.begin(), triplet.end()); std::sort(result.begin(), result.end());
    std::cout << '['; for (size_t i = 0; i < result.size(); ++i) { std::cout << '['; for (size_t j = 0; j < result[i].size(); ++j) { std::cout << result[i][j]; if (j + 1 < result[i].size()) std::cout << ','; } std::cout << ']'; if (i + 1 < result.size()) std::cout << ','; } std::cout << ']'; return 0;
}